import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { User } from 'lucide-react';

const GRID = [
  ['1', '.', 'W', '.', '.', '.', 'W', '2'],
  ['.', '.', 'W', '.', 'W', '.', 'W', '.'],
  ['.', '.', 'W', 'A', 'W', '.', '.', '.'],
  ['.', '.', 'W', '.', 'W', 'W', 'a', 'W'],
  ['.', '.', '.', '.', '.', '.', '.', '.'],
  ['W', 'W', 'W', '.', 'W', '.', 'W', 'W'],
  ['.', '.', '.', 'b', 'W', '.', 'B', '.'],
  ['.', 'W', 'E', '.', 'W', '.', '.', '.']
];

export const CoopEscape = ({ currentUser, gameState, setGameState, channelRef }: { currentUser: any, gameState: any, setGameState: any, channelRef: any }) => {
  const isP1 = gameState.p1 === currentUser.id;
  const isP2 = gameState.p2 === currentUser.id;
  const board = gameState.board;

  // KEYBOARD CONTROLS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.winner) return;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) requestMove(-1, 0);
      if (['ArrowDown', 's', 'S'].includes(e.key)) requestMove(1, 0);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) requestMove(0, -1);
      if (['ArrowRight', 'd', 'D'].includes(e.key)) requestMove(0, 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const requestMove = (dr: number, dc: number) => {
    if (!isP1 && !isP2) return;
    
    const me = isP1 ? board.p1Pos : board.p2Pos;
    if ((isP1 && board.p1Escaped) || (isP2 && board.p2Escaped)) return;

    const nr = me.r + dr;
    const nc = me.c + dc;

    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return;

    const cell = GRID[nr][nc];
    if (cell === 'W') return;
    if (cell === 'a' && !board.btnA) return;
    if (cell === 'b' && !board.btnB) return;

    const newState = { ...board };
    const newPos = { r: nr, c: nc };
    
    if (isP1) newState.p1Pos = newPos;
    else newState.p2Pos = newPos;

    if (nr === 2 && nc === 3) newState.btnA = true;
    if (nr === 6 && nc === 6) newState.btnB = true;

    if (nr === 7 && nc === 2) {
      if (isP1) newState.p1Escaped = true;
      if (isP2) newState.p2Escaped = true;
    }

    let winner = gameState.winner;
    if (newState.p1Escaped && newState.p2Escaped) {
       winner = 'COOP_WIN';
    }

    const nextGameState = { ...gameState, board: newState, winner };
    setGameState(nextGameState);
    channelRef.current.send({ type: 'broadcast', event: 'move', payload: { p1: gameState.p1, p2: gameState.p2, newState: nextGameState } });
  };

  const getCellBackground = (r: number, c: number, cell: string) => {
    if (cell === 'W') return '#334155'; // Wall
    if (cell === 'E') return '#fde047'; // Exit glow
    if (cell === 'a') return board.btnA ? '#f8fafc' : '#94a3b8'; // Door A
    if (cell === 'b') return board.btnB ? '#f8fafc' : '#94a3b8'; // Door B
    if (cell === 'A') return board.btnA ? '#86efac' : '#fecaca'; // Button A
    if (cell === 'B') return board.btnB ? '#86efac' : '#fecaca'; // Button B
    return '#f8fafc'; // Floor
  };

  const hasP1 = (r: number, c: number) => !board.p1Escaped && board.p1Pos.r === r && board.p1Pos.c === c;
  const hasP2 = (r: number, c: number) => !board.p2Escaped && board.p2Pos.r === r && board.p2Pos.c === c;

  return (
    <div style={{ width: '100%', maxWidth: 380, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ background: '#e2e8f0', padding: 8, borderRadius: 16, boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
          {GRID.map((row, r) => row.map((cell, c) => (
            <div key={`${r}-${c}`} style={{
              width: 36, height: 36, borderRadius: 6,
              background: getCellBackground(r, c, cell),
              border: cell === 'E' ? '2px dashed #ca8a04' : '1px solid rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              boxShadow: cell === 'W' ? 'inset 0 4px 0 rgba(255,255,255,0.1)' : 'none',
              transition: 'background 0.3s'
            }}>
                {(cell === 'a' && board.btnA) && <span style={{fontSize:10, opacity:0.5}}>OPEN</span>}
                {(cell === 'b' && board.btnB) && <span style={{fontSize:10, opacity:0.5}}>OPEN</span>}
                {cell === 'E' && <span style={{fontSize:16}}>🚪</span>}

                {/* Player Renders */}
                {hasP1(r, c) && (
                  <motion.div layout style={{ 
                    position: 'absolute', width: '80%', height: '80%', borderRadius: '50%', background: '#3b82f6', 
                    boxShadow: '0 2px 8px rgba(59,130,246,0.6)', border: '2px solid #fff', zIndex: 10 
                  }} />
                )}
                {hasP2(r, c) && (
                  <motion.div layout style={{ 
                    position: 'absolute', width: '80%', height: '80%', borderRadius: '50%', background: '#ef4444', 
                    boxShadow: '0 2px 8px rgba(239,68,68,0.6)', border: '2px solid #fff', zIndex: 10 
                  }} />
                )}
            </div>
          )))}
        </div>
      </div>

      {/* D-PAD Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 180 }}>
        <div />
        <button onClick={() => requestMove(-1, 0)} style={btnStyle}>⬆️</button>
        <div />
        <button onClick={() => requestMove(0, -1)} style={btnStyle}>⬅️</button>
        <button onClick={() => requestMove(1, 0)} style={btnStyle}>⬇️</button>
        <button onClick={() => requestMove(0, 1)} style={btnStyle}>➡️</button>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginTop: 16 }}>Use D-Pad or Arrow Keys</p>
    </div>
  );
};

const btnStyle = {
  aspectRatio: '1', borderRadius: 16, border: 'none', background: '#fff', fontSize: 24,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05), inset 0 -4px 0 rgba(0,0,0,0.05)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};
