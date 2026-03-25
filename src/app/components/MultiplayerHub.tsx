import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, ArrowLeft, Loader2, Users, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';

interface TravelerData {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  vehicle_id: string;
  to_location: string;
}

interface GameState {
  board: (string | null)[];
  xIsNext: boolean;
  winner: string | 'draw' | null;
  p1: string; // user_id of X
  p2: string; // user_id of O
}

export const MultiplayerHub: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentCheckin, setCurrentCheckin] = useState<TravelerData | null>(null);
  const [travelers, setTravelers] = useState<TravelerData[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<{ from: string, name: string } | null>(null);
  const [sentInviteTo, setSentInviteTo] = useState<string | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('name, avatar_url').eq('user_id', user.id).single();
      setCurrentUser({ id: user.id, name: profile?.name || 'Traveler', avatar_url: profile?.avatar_url });

      const { data: checkin } = await supabase
        .from('checkins').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!checkin) { navigate('/check-in'); return; }
      setCurrentCheckin(checkin);

      const { data: tvlrs } = await supabase
        .from('checkins').select('*')
        .eq('vehicle_id', checkin.vehicle_id)
        .eq('is_active', true)
        .neq('user_id', user.id);
      
      setTravelers(tvlrs || []);

      // Real-time channel for multiplayer
      const channel = supabase.channel(`games-${checkin.vehicle_id}`, {
        config: { broadcast: { self: true } }
      });

      channel
        .on('broadcast', { event: 'invite' }, (payload) => {
          if (payload.payload.to === user.id) {
            setIncomingInvite({ from: payload.payload.from, name: payload.payload.fromName });
            toast(`🎮 ${payload.payload.fromName} invited you to play!`, { icon: '🎲' });
          }
        })
        .on('broadcast', { event: 'accept' }, (payload) => {
          if (payload.payload.to === user.id) {
            toast.success(`${payload.payload.fromName} accepted! Starting game...`);
            setSentInviteTo(null);
            startGame(user.id, payload.payload.from);
          }
        })
        .on('broadcast', { event: 'decline' }, (payload) => {
          if (payload.payload.to === user.id) {
            toast.error(`${payload.payload.fromName} declined your invite.`);
            setSentInviteTo(null);
          }
        })
        .on('broadcast', { event: 'move' }, (payload) => {
           setGameState(prev => {
             if (!prev) return null;
             // Ensure the move is for this ongoing match
             if ((prev.p1 === payload.payload.p1) && (prev.p2 === payload.payload.p2)) {
               return payload.payload.newState;
             }
             return prev;
           });
        })
        .on('broadcast', { event: 'leave' }, (payload) => {
           // We expect the other player who triggered 'leave' to match our game
           // A broader implementation would include user IDs in the payload, but this is simple enough for the prototype
           setGameActive(false);
           setGameState(null);
           toast.error('The other player left the game.');
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setLoading(false);
        });

      channelRef.current = channel;
    };
    init();

    return () => {
      if (channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [navigate]);

  const startGame = (p1: string, p2: string) => {
    setGameActive(true);
    setGameState({
      board: Array(9).fill(null),
      xIsNext: true,
      winner: null,
      p1,
      p2
    });
  };

  const sendInvite = async (traveler: TravelerData) => {
    if (!channelRef.current || !currentUser) return;
    setSentInviteTo(traveler.user_id);
    channelRef.current.send({
      type: 'broadcast',
      event: 'invite',
      payload: { from: currentUser.id, fromName: currentUser.name, to: traveler.user_id }
    });
    // Send Push Notification securely
    notify.gameInvite(traveler.user_id, currentUser.name, 'Tic-Tac-Toe');
    toast('Invite sent! Waiting for response...');
  };

  const respondInvite = (accept: boolean) => {
    if (!channelRef.current || !currentUser || !incomingInvite) return;
    channelRef.current.send({
      type: 'broadcast',
      event: accept ? 'accept' : 'decline',
      payload: { from: currentUser.id, fromName: currentUser.name, to: incomingInvite.from }
    });
    if (accept) {
      startGame(incomingInvite.from, currentUser.id); // original sender is P1 (X), acceptor is P2 (O)
    }
    setIncomingInvite(null);
  };

  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (!squares.includes(null)) return 'draw';
    return null;
  };

  const handleMove = (index: number) => {
    if (!gameState || !channelRef.current || !currentUser) return;
    if (gameState.winner || gameState.board[index]) return;

    const isMyTurn = (gameState.xIsNext && gameState.p1 === currentUser.id) || 
                     (!gameState.xIsNext && gameState.p2 === currentUser.id);
                     
    if (!isMyTurn) {
      toast.error("It's not your turn!");
      return;
    }

    const newBoard = [...gameState.board];
    newBoard[index] = gameState.xIsNext ? 'X' : 'O';
    const winner = calculateWinner(newBoard);

    const newState: GameState = {
      ...gameState,
      board: newBoard,
      xIsNext: !gameState.xIsNext,
      winner
    };

    setGameState(newState);
    channelRef.current.send({
      type: 'broadcast',
      event: 'move',
      payload: { p1: gameState.p1, p2: gameState.p2, newState }
    });
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)' }}>
        <Loader2 className="animate-spin" style={{ color: '#0ea5e9' }} size={32} />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', background: 'linear-gradient(160deg, #f0fdf4 0%, #e0f2fe 100%)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <button onClick={() => {
            if (gameActive) {
                setGameActive(false);
                if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
            } else {
                navigate(-1);
            }
        }} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0f172a' }}>Game Hub</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Vehicle: {currentCheckin?.vehicle_id}</p>
        </div>
        <Gamepad2 size={24} color="#0ea5e9" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!gameActive ? (
          <div>
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: '#1e293b' }}>Online Co-Travelers</h2>
              {travelers.length === 0 ? (
                <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No other travelers are currently checked in to your vehicle.</p>
              ) : (
                travelers.map(t => (
                  <div key={t.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {t.avatar_url ? <img src={t.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <Users size={20} color="#0284c7" />}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, margin: 0, fontSize: 15, color: '#0f172a' }}>{t.name}</p>
                      </div>
                    </div>
                    {sentInviteTo === t.user_id ? (
                      <span style={{ fontSize: 12, color: '#0ea5e9', fontWeight: 600 }}>Sent...</span>
                    ) : (
                      <button onClick={() => sendInvite(t)} style={{ padding: '6px 14px', borderRadius: 20, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Invite
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <AnimatePresence>
              {incomingInvite && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '2px solid #0ea5e9' }}>
                  <p style={{ fontWeight: 700, margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>🎮 {incomingInvite.name} challenged you to Tic-Tac-Toe!</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => respondInvite(true)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#22c55e', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><Check size={20} /></button>
                    <button onClick={() => respondInvite(false)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><X size={20} /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ textAlign: 'center', marginTop: 30, opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: '#64748b' }}>More multiplayer games (Uno, Ludo) coming soon in updates!</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 320, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
              <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 20px' }}>Tic Tac Toe</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ background: gameState?.p1 === currentUser?.id ? '#e0f2fe' : '#f1f5f9', padding: '6px 12px', borderRadius: 12, fontWeight: 800, color: '#0369a1' }}>X: {gameState?.p1 === currentUser?.id ? 'You' : 'Opponent'}</div>
                <div style={{ background: gameState?.p2 === currentUser?.id ? '#e0f2fe' : '#f1f5f9', padding: '6px 12px', borderRadius: 12, fontWeight: 800, color: '#0369a1' }}>O: {gameState?.p2 === currentUser?.id ? 'You' : 'Opponent'}</div>
              </div>

              {gameState?.winner ? (
                <div style={{ textAlign: 'center', marginBottom: 20, padding: 12, background: '#f0fdf4', borderRadius: 12, color: '#16a34a', fontWeight: 800 }}>
                  {gameState.winner === 'draw' ? "It's a Draw!" : `${gameState.winner} Wins!`}
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: 20, fontWeight: 700, color: '#64748b' }}>
                  {((gameState?.xIsNext && gameState?.p1 === currentUser?.id) || (!gameState?.xIsNext && gameState?.p2 === currentUser?.id)) ? "🟢 Your Turn!" : "⏳ Waiting for opponent..."}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#cbd5e1', padding: 8, borderRadius: 16 }}>
                {gameState?.board.map((cell, i) => (
                  <button
                    key={i}
                    onClick={() => handleMove(i)}
                    disabled={!!gameState?.winner || !!cell}
                    style={{ aspectRatio: '1', background: '#fff', borderRadius: 8, border: 'none', fontSize: 40, fontWeight: 900, color: cell === 'X' ? '#0ea5e9' : '#f43f5e', cursor: (gameState?.winner || cell) ? 'default' : 'pointer' }}
                  >
                    {cell}
                  </button>
                ))}
              </div>
            </div>
            
            <button onClick={() => { 
                setGameActive(false); 
                if(channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
              }} style={{ marginTop: 30, padding: '12px 24px', borderRadius: 20, background: '#fff', border: '2px solid #e2e8f0', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
              Leave Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
