import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Aperture, Wind } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const SCAVENGER_ITEMS = [
  { id: 'cow', name: 'A Cow', icon: '🐄', color: '#10b981' },
  { id: 'bridge', name: 'A Bridge', icon: '🌉', color: '#6366f1' },
  { id: 'police', name: 'Police Car', icon: '🚓', color: '#f43f5e' },
  { id: 'river', name: 'River or Lake', icon: '🌊', color: '#0ea5e9' },
  { id: ' windmill', name: 'Windmill / Turbine', icon: '🌬️', color: '#f59e0b' },
  { id: 'red_door', name: 'A Red Door', icon: '🚪', color: '#ef4444' },
  { id: 'train', name: 'Another Train/Bus', icon: '🚆', color: '#8b5cf6' },
  { id: 'church', name: 'Church Spire', icon: '⛪', color: '#14b8a6' },
];

export const WindowScavenger = ({ currentUser, gameState, setGameState, channelRef }: { currentUser: any, gameState: any, setGameState: any, channelRef: any }) => {
  const { width, height } = useWindowSize();
  const [localClicked, setLocalClicked] = useState<string[]>([]);
  
  const isP1 = gameState.p1 === currentUser.id;
  const isP2 = gameState.p2 === currentUser.id;
  if (!isP1 && !isP2) return <div style={{textAlign:'center', padding:40, color:'#94a3b8'}}>Watch mode not available for Scavenger Hunt</div>;

  const foundItems = gameState.board?.foundItems || [];

  const handleSpotItem = (itemId: string) => {
    if (gameState.winner || foundItems.includes(itemId)) return;
    
    // In this simple co-op game, if someone taps it, it's considered "found".
    // A more complex version would require both players to tap (e.g., localClicked).
    // Let's implement immediate find for faster gameplay.
    const newFoundItems = [...foundItems, itemId];
    
    let winner = null;
    if (newFoundItems.length === SCAVENGER_ITEMS.length) {
      winner = 'COOP_WIN';
    }

    const newState = { foundItems: newFoundItems };
    const nextGameState = { ...gameState, board: newState, winner };
    
    setGameState(nextGameState);
    channelRef.current.send({ 
       type: 'broadcast', 
       event: 'move', 
       payload: { p1: gameState.p1, p2: gameState.p2, newState: nextGameState } 
    });
  };

  return (
    <div style={{ width: '100%', maxWidth: 500, margin: '0 auto' }}>
       {gameState.winner === 'COOP_WIN' && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}
       
       <div style={{ background: '#f8fafc', padding: 20, borderRadius: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Spot them together!</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Look out the window and tap when you see it.</p>
            </div>
            <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px 14px', borderRadius: 20, fontWeight: 800 }}>
              {foundItems.length} / {SCAVENGER_ITEMS.length}
            </div>
         </div>

         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {SCAVENGER_ITEMS.map(item => {
               const isFound = foundItems.includes(item.id);
               return (
                  <motion.button 
                    key={item.id}
                    whileTap={{ scale: isFound ? 1 : 0.95 }}
                    onClick={() => handleSpotItem(item.id)}
                    disabled={isFound || !!gameState.winner}
                    style={{ 
                       display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                       background: isFound ? `${item.color}15` : '#fff', 
                       border: `2px solid ${isFound ? item.color : '#e2e8f0'}`,
                       borderRadius: 16, cursor: isFound ? 'default' : 'pointer',
                       boxShadow: isFound ? 'none' : '0 4px 12px rgba(0,0,0,0.03)',
                       color: isFound ? item.color : '#334155',
                       textAlign: 'left', transition: 'all 0.2s'
                    }}
                  >
                     <div style={{ fontSize: 24, filter: isFound ? 'none' : 'grayscale(1)', opacity: isFound ? 1 : 0.6 }}>
                        {item.icon}
                     </div>
                     <span style={{ fontWeight: 700, fontSize: 14, flex: 1, textDecoration: isFound ? 'line-through' : 'none', opacity: isFound ? 0.7 : 1 }}>
                        {item.name}
                     </span>
                     {isFound && <Check size={18} color={item.color} />}
                  </motion.button>
               );
            })}
         </div>
       </div>
    </div>
  );
};
