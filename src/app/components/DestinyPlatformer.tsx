import React, { useEffect, useRef } from 'react';

function AABB(r1: any, r2: any) {
  return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
         r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

const LEVEL = {
  walls: [
      {x: 0, y: 480, w: 800, h: 120, color: '#334155'},
      {x: 0, y: 0, w: 20, h: 600, color: '#334155'},
      {x: 780, y: 0, w: 20, h: 600, color: '#334155'},
      {x: 400, y: 200, w: 30, h: 150, color: '#475569'},
      {x: 200, y: 350, w: 100, h: 20, color: '#475569'},
      {x: 600, y: 420, w: 180, h: 60, color: '#334155'},
      {x: 660, y: 360, w: 120, h: 60, color: '#334155'},
      {x: 720, y: 300, w: 60, h: 60, color: '#334155'},
  ],
  doorA: {x: 240, y: 200, w: 20, h: 150, color: '#f59e0b'},
  doorB: {x: 400, y: 350, w: 30, h: 130, color: '#3b82f6'},
  btnA: {x: 60, y: 470, w: 50, h: 10, color: '#fcd34d'},
  btnB: {x: 460, y: 470, w: 50, h: 10, color: '#93c5fd'},
  exit: {x: 730, y: 200, w: 40, h: 100, color: '#22c55e'}
};

export const DestinyPlatformer = ({ currentUser, gameState, setGameState, channelRef }: { currentUser: any, gameState: any, setGameState: any, channelRef: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const pState = useRef({
      p1: { x: 100, y: 400, vx: 0, vy: 0, w: 32, h: 32, onGround: false },
      p2: { x: 200, y: 400, vx: 0, vy: 0, w: 32, h: 32, onGround: false },
      keys: {
          p1: { up: false, left: false, right: false },
          p2: { up: false, left: false, right: false },
      },
      btnA: false,
      btnB: false,
      escaped: false
  });

  const isP1 = gameState.p1 === currentUser.id;
  const myPid = isP1 ? 'p1' : 'p2';

  const handleKey = (action: 'up' | 'left' | 'right', pressed: boolean) => {
      if (gameState.winner) return;
      if (pState.current.keys[myPid][action] === pressed) return;

      pState.current.keys[myPid][action] = pressed;
      triggerKeysSync();
  };

  const triggerKeysSync = () => {
      if (channelRef.current) {
          channelRef.current.send({
              type: 'broadcast', event: 'platformer_keys',
              payload: { pid: myPid, keys: pState.current.keys[myPid] }
          });
      }
  };

  useEffect(() => {
      const handleKD = (e: KeyboardEvent) => {
          if (e.key === 'ArrowUp' || e.key === 'w') handleKey('up', true);
          if (e.key === 'ArrowLeft' || e.key === 'a') handleKey('left', true);
          if (e.key === 'ArrowRight' || e.key === 'd') handleKey('right', true);
      };
      const handleKU = (e: KeyboardEvent) => {
          if (e.key === 'ArrowUp' || e.key === 'w') handleKey('up', false);
          if (e.key === 'ArrowLeft' || e.key === 'a') handleKey('left', false);
          if (e.key === 'ArrowRight' || e.key === 'd') handleKey('right', false);
      };

      window.addEventListener('keydown', handleKD);
      window.addEventListener('keyup', handleKU);
      
      const channel = channelRef.current;
      let sub1: any, sub2: any;
      if (channel) {
          sub1 = channel.on('broadcast', { event: 'platformer_keys' }, (payload: any) => {
              if (payload.payload.pid !== myPid) {
                  pState.current.keys[payload.payload.pid as 'p1'|'p2'] = payload.payload.keys;
              }
          });
          sub2 = channel.on('broadcast', { event: 'platformer_sync' }, (payload: any) => {
              if (payload.payload.pid !== myPid) {
                  const stateRef = pState.current[payload.payload.pid as 'p1'|'p2'];
                  if (Math.abs(stateRef.x - payload.payload.x) > 15) stateRef.x = payload.payload.x;
                  if (Math.abs(stateRef.y - payload.payload.y) > 15) stateRef.y = payload.payload.y;
              }
          });
      }

      const syncInterval = setInterval(() => {
          if (channelRef.current && !pState.current.escaped) {
              channelRef.current.send({
                  type: 'broadcast', event: 'platformer_sync',
                  payload: { pid: myPid, x: pState.current[myPid].x, y: pState.current[myPid].y }
              });
          }
      }, 500);

      let reqId: number;
      let lastTime = performance.now();
      let accumulator = 0;
      const MS_PER_UPDATE = 1000 / 60;
      
      const speed = 4;
      const jumpPower = -12;
      const gravity = 0.5;

      const runPhysics = () => {
          const s = pState.current;
          if (s.escaped) return;

          s.btnA = AABB(s.p1, LEVEL.btnA) || AABB(s.p2, LEVEL.btnA);
          s.btnB = AABB(s.p1, LEVEL.btnB) || AABB(s.p2, LEVEL.btnB);

          let activeWalls = [...LEVEL.walls];
          if (!s.btnA) activeWalls.push(LEVEL.doorA);
          if (!s.btnB) activeWalls.push(LEVEL.doorB);

          ['p1', 'p2'].forEach((pidKey) => {
              let pid = pidKey as 'p1' | 'p2';
              let p = s[pid];
              let k = s.keys[pid];

              p.vx = (k.left ? -speed : 0) + (k.right ? speed : 0);
              p.vy += gravity;

              p.x += p.vx;
              for (let w of activeWalls) {
                  if (AABB(p, w)) {
                      if (p.vx > 0) p.x = w.x - p.w;
                      else if (p.vx < 0) p.x = w.x + w.w;
                      p.vx = 0;
                  }
              }

              p.y += p.vy;
              p.onGround = false;
              for (let w of activeWalls) {
                  if (AABB(p, w)) {
                      if (p.vy > 0) {
                          p.y = w.y - p.h;
                          p.vy = 0;
                          p.onGround = true;
                      } else if (p.vy < 0) {
                          p.y = w.y + w.h;
                          p.vy = 0;
                      }
                  }
              }

              if (p.vy > 15) p.vy = 15;

              if (k.up && p.onGround) {
                  p.vy = jumpPower;
                  p.onGround = false;
              }
              
              if (p.x < 0) p.x = 0;
              if (p.x > 800 - p.w) p.x = 800 - p.w;
              if (p.y > 600) p.y = 600;
          });

          if (AABB(s.p1, LEVEL.exit) && AABB(s.p2, LEVEL.exit)) {
              s.escaped = true;
              setGameState((prev: any) => ({ ...prev, winner: 'COOP_WIN' }));
          }
      };

      const render = () => {
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx) return;
          const s = pState.current;

          ctx.clearRect(0, 0, 800, 600);

          LEVEL.walls.forEach(w => {
              ctx.fillStyle = w.color;
              ctx.fillRect(w.x, w.y, w.w, w.h);
          });

          if (!s.btnA) {
              ctx.fillStyle = LEVEL.doorA.color;
              ctx.fillRect(LEVEL.doorA.x, LEVEL.doorA.y, LEVEL.doorA.w, LEVEL.doorA.h);
          }
          if (!s.btnB) {
              ctx.fillStyle = LEVEL.doorB.color;
              ctx.fillRect(LEVEL.doorB.x, LEVEL.doorB.y, LEVEL.doorB.w, LEVEL.doorB.h);
          }

          ctx.fillStyle = s.btnA ? '#4ade80' : LEVEL.btnA.color;
          ctx.fillRect(LEVEL.btnA.x, LEVEL.btnA.y, LEVEL.btnA.w, LEVEL.btnA.h);
          ctx.fillStyle = s.btnB ? '#4ade80' : LEVEL.btnB.color;
          ctx.fillRect(LEVEL.btnB.x, LEVEL.btnB.y, LEVEL.btnB.w, LEVEL.btnB.h);

          ctx.fillStyle = LEVEL.exit.color;
          ctx.beginPath();
          ctx.arc(LEVEL.exit.x + 20, LEVEL.exit.y + 50, 40, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('EXIT', LEVEL.exit.x - 2, LEVEL.exit.y + 5);

          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(s.p1.x, s.p1.y, s.p1.w, s.p1.h);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.strokeRect(s.p1.x, s.p1.y, s.p1.w, s.p1.h);
          ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('P1', s.p1.x + 8, s.p1.y + 20);

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(s.p2.x, s.p2.y, s.p2.w, s.p2.h);
          ctx.strokeRect(s.p2.x, s.p2.y, s.p2.w, s.p2.h);
          ctx.fillStyle = '#fff'; ctx.fillText('P2', s.p2.x + 8, s.p2.y + 20);
      };

      const loop = (time: number) => {
          let dt = time - lastTime;
          lastTime = time;
          accumulator += dt;

          while (accumulator >= MS_PER_UPDATE) {
              runPhysics();
              accumulator -= MS_PER_UPDATE;
          }
          
          render();
          reqId = requestAnimationFrame(loop);
      };
      
      reqId = requestAnimationFrame(loop);

      return () => {
          window.removeEventListener('keydown', handleKD);
          window.removeEventListener('keyup', handleKU);
          cancelAnimationFrame(reqId);
          clearInterval(syncInterval);
          if (sub1) sub1.unsubscribe();
          if (sub2) sub2.unsubscribe();
      };
  }, [gameState.winner]);

  const btnStyle = {
      width: 50, height: 50, borderRadius: 25, border: 'none', background: 'rgba(255,255,255,0.8)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
      touchAction: 'none' as const, userSelect: 'none' as const, cursor: 'pointer'
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <canvas 
            ref={canvasRef} 
            width={800} height={600} 
            style={{ 
                width: '100%', maxWidth: '800px', aspectRatio: '4/3', 
                backgroundColor: '#0f172a', borderRadius: 12, border: '4px solid #334155' 
            }} 
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginTop: 20, padding: '0 10px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onPointerDown={() => handleKey('left', true)} onPointerUp={() => handleKey('left', false)} onPointerLeave={() => handleKey('left', false)}
                  style={btnStyle}>⬅️</button>
                <button 
                  onPointerDown={() => handleKey('right', true)} onPointerUp={() => handleKey('right', false)} onPointerLeave={() => handleKey('right', false)}
                  style={btnStyle}>➡️</button>
            </div>
            <div>
                <button 
                  onPointerDown={() => handleKey('up', true)} onPointerUp={() => handleKey('up', false)} onPointerLeave={() => handleKey('up', false)}
                  style={{...btnStyle, width: 70, borderRadius: 12 }}>⬆️</button>
            </div>
        </div>
        <p style={{marginTop: 10, fontSize: 13, color: '#64748b'}}>Use screen buttons or WASD / Arrow Keys</p>
    </div>
  );
};
