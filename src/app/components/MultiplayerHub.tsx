import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, ArrowLeft, Loader2, Users, Check, X, Grid, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

type GameType = 'tictactoe' | 'connect4' | 'chess';

interface TravelerData {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  vehicle_id: string;
}

interface GameState {
  type: GameType;
  board: any;
  xIsNext: boolean;
  winner: string | 'draw' | null;
  p1: string; // user_id of P1 (Red/X/White)
  p2: string; // user_id of P2 (Yellow/O/Black)
}

const GAMES = [
  { id: 'connect4' as GameType, name: 'Connect 4', icon: <Circle size={22} color="#fff" fill="#ef4444" />, bg: 'linear-gradient(135deg, #ef4444, #dc2626)', desc: 'Travel Edition Drop Token' },
  { id: 'tictactoe' as GameType, name: 'Tic Tac Toe', icon: <Grid size={22} color="#0ea5e9" />, bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', textColor: '#0369a1', desc: 'Classic 3x3 Grid Match' },
  { id: 'chess' as GameType, name: 'Chess', icon: <span style={{fontSize: 22, lineHeight: 1}}>♟️</span>, bg: 'linear-gradient(135deg, #1e293b, #0f172a)', desc: 'Grandmaster Classic (FEN)' },
];

export const MultiplayerHub: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentCheckin, setCurrentCheckin] = useState<TravelerData | null>(null);
  const [travelers, setTravelers] = useState<TravelerData[]>([]);
  
  // Hub States
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [incomingInvite, setIncomingInvite] = useState<{ from: string, name: string, gameType: GameType } | null>(null);
  const [sentInviteTo, setSentInviteTo] = useState<string | null>(null);
  
  // Active Game States
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

      const channel = supabase.channel(`games-${checkin.vehicle_id}`, {
        config: { broadcast: { self: true } }
      });

      channel
        .on('broadcast', { event: 'invite' }, (payload) => {
          if (payload.payload.to === user.id) {
            setIncomingInvite({ from: payload.payload.from, name: payload.payload.fromName, gameType: payload.payload.gameType });
            toast(`🎮 ${payload.payload.fromName} invited you to play!`);
          }
        })
        .on('broadcast', { event: 'accept' }, (payload) => {
          if (payload.payload.to === user.id) {
            toast.success(`${payload.payload.fromName} accepted! Starting...`);
            setSentInviteTo(null);
            startGame(user.id, payload.payload.from, payload.payload.gameType);
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
             if ((prev.p1 === payload.payload.p1) && (prev.p2 === payload.payload.p2)) {
               return payload.payload.newState;
             }
             return prev;
           });
        })
        .on('broadcast', { event: 'leave' }, () => {
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

  const startGame = (p1: string, p2: string, type: GameType) => {
    setGameActive(true);
    setGameState({
      type,
      board: type === 'tictactoe' 
        ? Array(9).fill(null) 
        : type === 'connect4'
          ? Array(6).fill(null).map(() => Array(7).fill(null))
          : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // valid FEN string for chess
      xIsNext: true,
      winner: null,
      p1, p2
    });
  };

  const sendInvite = async (traveler: TravelerData) => {
    if (!channelRef.current || !currentUser) return;
    setSentInviteTo(traveler.user_id);
    channelRef.current.send({
      type: 'broadcast',
      event: 'invite',
      payload: { from: currentUser.id, fromName: currentUser.name, to: traveler.user_id, gameType: selectedGame }
    });
    
    const gameName = GAMES.find(g => g.id === selectedGame)?.name || 'a game';
    notify.gameInvite(traveler.user_id, currentUser.name, gameName);
    toast('Challenge sent! Waiting for response...');
  };

  const respondInvite = (accept: boolean) => {
    if (!channelRef.current || !currentUser || !incomingInvite) return;
    channelRef.current.send({
      type: 'broadcast',
      event: accept ? 'accept' : 'decline',
      payload: { from: currentUser.id, fromName: currentUser.name, to: incomingInvite.from, gameType: incomingInvite.gameType }
    });
    if (accept) {
      startGame(incomingInvite.from, currentUser.id, incomingInvite.gameType);
    }
    setIncomingInvite(null);
  };

  // --- TIC TAC TOE LOGIC ---
  const handleTicTacToeMove = (index: number) => {
    if (!gameState || gameState.winner || gameState.board[index] || gameState.type !== 'tictactoe') return;
    
    const isMyTurn = (gameState.xIsNext && gameState.p1 === currentUser.id) || (!gameState.xIsNext && gameState.p2 === currentUser.id);
    if (!isMyTurn) return;

    const newBoard = [...gameState.board];
    newBoard[index] = gameState.xIsNext ? 'X' : 'O';
    
    // Check win
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winner = null;
    for (const [a, b, c] of lines) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) winner = newBoard[a];
    }
    if (!winner && !newBoard.includes(null)) winner = 'draw';

    updateGame(newBoard, winner);
  };

  // --- CONNECT 4 LOGIC ---
  const handleConnect4Move = (col: number) => {
    if (!gameState || gameState.winner || gameState.type !== 'connect4') return;
    
    const isMyTurn = (gameState.xIsNext && gameState.p1 === currentUser.id) || (!gameState.xIsNext && gameState.p2 === currentUser.id);
    if (!isMyTurn) return;

    const newBoard = gameState.board.map((row: any) => [...row]);
    let playedRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (!newBoard[r][col]) {
        newBoard[r][col] = gameState.xIsNext ? 'P1' : 'P2';
        playedRow = r;
        break;
      }
    }
    if (playedRow === -1) return; // Col full

    // Check Win
    const token = newBoard[playedRow][col];
    const dirs = [[0,1], [1,0], [1,1], [1,-1]];
    let winner = null;
    
    for (const [dr, dc] of dirs) {
      let count = 1;
      let r = playedRow + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && newBoard[r][c] === token) { count++; r+=dr; c+=dc; }
      r = playedRow - dr; c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && newBoard[r][c] === token) { count++; r-=dr; c-=dc; }
      if (count >= 4) winner = token;
    }
    
    if (!winner && newBoard.every((row: any) => row.every((cell: any) => cell !== null))) winner = 'draw';

    updateGame(newBoard, winner);
  };

  // --- CHESS LOGIC ---
  const handleChessMove = (sourceSquare: string, targetSquare: string) => {
    if (!gameState || gameState.winner || gameState.type !== 'chess') return false;
    
    const isMyTurn = (gameState.xIsNext && gameState.p1 === currentUser.id) || (!gameState.xIsNext && gameState.p2 === currentUser.id);
    if (!isMyTurn) return false;

    const game = new Chess(gameState.board);
    
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) return false;

      let winner = null;
      if (game.isCheckmate()) {
        winner = gameState.xIsNext ? 'P1' : 'P2';
      } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
        winner = 'draw';
      }

      updateGame(game.fen(), winner);
      return true;
    } catch(e) {
      return false;
    }
  };

  const updateGame = (newBoard: any, winner: string | 'draw' | null) => {
    if (!gameState || !channelRef.current) return;
    const newState: GameState = {
      ...gameState, board: newBoard, xIsNext: !gameState.xIsNext, winner
    };
    setGameState(newState);
    channelRef.current.send({ type: 'broadcast', event: 'move', payload: { p1: gameState.p1, p2: gameState.p2, newState } });
  };

  const getStatusMessage = () => {
    if (gameState?.winner === 'draw') return "It's a Draw!";
    if (gameState?.winner) return `${gameState.winner === 'P1' || gameState.winner === 'X' ? 'Player 1' : 'Player 2'} Wins! 🎉`;
    const isMyTurn = (gameState?.xIsNext && gameState?.p1 === currentUser?.id) || (!gameState?.xIsNext && gameState?.p2 === currentUser?.id);
    
    if (gameState?.type === 'chess') {
        const myColor = gameState.p1 === currentUser?.id ? 'White' : 'Black';
        return isMyTurn ? `🟢 Your Turn (${myColor})!` : `⏳ Waiting for opponent...`;
    }
    
    return isMyTurn ? "🟢 Your Turn!" : "⏳ Waiting for opponent...";
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)' }}>
        <Loader2 className="animate-spin" style={{ color: '#0ea5e9' }} size={32} />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <button onClick={() => {
            if (gameActive) {
                setGameActive(false);
                if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
            } else {
                navigate(-1);
            }
        }} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#475569" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0f172a' }}>Multiplayer Hub</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Vehicle: {currentCheckin?.vehicle_id}</p>
        </div>
        <Gamepad2 size={24} color="#6366f1" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!gameActive ? (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: '#1e293b' }}>Select a Game</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {GAMES.slice(0, 2).map(g => (
                  <motion.button key={g.id} whileTap={{ scale: 0.96 }} onClick={() => setSelectedGame(g.id)}
                    style={{ 
                      padding: 16, borderRadius: 16, border: selectedGame === g.id ? `2px solid ${g.textColor || '#fff'}` : '2px solid transparent',
                      background: g.bg, color: g.textColor || '#fff', textAlign: 'left', cursor: 'pointer',
                      boxShadow: selectedGame === g.id ? '0 8px 20px rgba(0,0,0,0.15)' : 'none', filter: selectedGame !== g.id ? 'grayscale(0.7) opacity(0.8)' : 'none',
                      transition: 'all 0.2s'
                    }}>
                    {g.icon}
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: '8px 0 2px' }}>{g.name}</h3>
                    <p style={{ fontSize: 11, opacity: 0.9, margin: 0 }}>{g.desc}</p>
                  </motion.button>
                ))}
              </div>
              <motion.button key={GAMES[2].id} whileTap={{ scale: 0.96 }} onClick={() => setSelectedGame(GAMES[2].id)}
                style={{ 
                  padding: 16, borderRadius: 16, border: selectedGame === GAMES[2].id ? `2px solid ${GAMES[2].textColor || '#fff'}` : '2px solid transparent',
                  background: GAMES[2].bg, color: GAMES[2].textColor || '#fff', textAlign: 'left', cursor: 'pointer',
                  boxShadow: selectedGame === GAMES[2].id ? '0 8px 20px rgba(0,0,0,0.15)' : 'none', filter: selectedGame !== GAMES[2].id ? 'grayscale(0.7) opacity(0.8)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 16
                }}>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>{GAMES[2].icon}</div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>{GAMES[2].name}</h3>
                  <p style={{ fontSize: 11, opacity: 0.9, margin: 0 }}>{GAMES[2].desc}</p>
                </div>
              </motion.button>
            </div>

            <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>Online Co-Travelers</h2>
                <span style={{ fontSize: 12, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>Invite to Play</span>
              </div>
              
              {travelers.length === 0 ? (
                <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No other travelers are currently checked in to your vehicle.</p>
              ) : (
                travelers.map(t => (
                  <div key={t.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {t.avatar_url ? <img src={t.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <Users size={20} color="#94a3b8" />}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, margin: 0, fontSize: 15, color: '#0f172a' }}>{t.name}</p>
                      </div>
                    </div>
                    {sentInviteTo === t.user_id ? (
                      <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Invite Sent...</span>
                    ) : (
                      <button onClick={() => sendInvite(t)} style={{ padding: '6px 16px', borderRadius: 20, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                        Challenge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <AnimatePresence>
              {incomingInvite && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 12px 30px rgba(0,0,0,0.15)', border: '2px solid #6366f1', position: 'sticky', bottom: 20 }}>
                  <p style={{ fontWeight: 800, margin: '0 0 4px', fontSize: 16, color: '#0f172a' }}>Incoming Challenge! 🎲</p>
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b' }}>{incomingInvite.name} wants to play <strong>{GAMES.find(g => g.id === incomingInvite.gameType)?.name}</strong></p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => respondInvite(true)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={18} /> Accept</button>
                    <button onClick={() => respondInvite(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><X size={18} /> Decline</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            {/* IN-GAME RENDER */}
            <div style={{ background: '#fff', borderRadius: 24, padding: '24px 16px', width: '100%', maxWidth: 400, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {gameState?.type === 'connect4' ? <Circle fill="#ef4444" color="#fff" size={24} /> : gameState?.type === 'chess' ? <span style={{fontSize: 24, lineHeight: 1}}>♟️</span> : <Grid color="#0ea5e9" size={24} />}
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {gameState?.type === 'connect4' ? 'Connect 4' : gameState?.type === 'chess' ? 'Chess' : 'Tic Tac Toe'}
                </h2>
              </div>
              
              {/* Scoreboard / Players */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, background: '#f8fafc', padding: 8, borderRadius: 16 }}>
                <div style={{ background: gameState?.p1 === currentUser?.id ? '#fff' : 'transparent', padding: '8px 16px', borderRadius: 12, fontWeight: 800, color: gameState?.type === 'connect4' ? '#ef4444' : gameState?.type === 'chess' ? '#475569' : '#0ea5e9', flex: 1, textAlign: 'center', boxShadow: gameState?.p1 === currentUser?.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                  {gameState?.type === 'connect4' ? '🔴' : gameState?.type === 'chess' ? '♔' : '❌'} {gameState?.p1 === currentUser?.id ? 'You' : 'Opponent'}
                </div>
                <div style={{ background: gameState?.p2 === currentUser?.id ? '#fff' : 'transparent', padding: '8px 16px', borderRadius: 12, fontWeight: 800, color: gameState?.type === 'connect4' ? '#eab308' : gameState?.type === 'chess' ? '#0f172a' : '#f43f5e', flex: 1, textAlign: 'center', boxShadow: gameState?.p2 === currentUser?.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                  {gameState?.type === 'connect4' ? '🟡' : gameState?.type === 'chess' ? '♚' : '⭕'} {gameState?.p2 === currentUser?.id ? 'You' : 'Opponent'}
                </div>
              </div>

              {/* Status Banner */}
              <div style={{ textAlign: 'center', marginBottom: 24, padding: 14, background: gameState?.winner ? (gameState.winner === 'draw' ? '#f1f5f9' : '#f0fdf4') : '#eff6ff', borderRadius: 14, color: gameState?.winner ? (gameState.winner === 'draw' ? '#64748b' : '#16a34a') : '#3b82f6', fontWeight: 800, fontSize: 16, border: `2px solid ${gameState?.winner ? (gameState.winner === 'draw' ? '#e2e8f0' : '#bbf7d0') : '#bfdbfe'}` }}>
                {getStatusMessage()}
              </div>

              {/* BOARDS */}
              {gameState?.type === 'tictactoe' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#e2e8f0', padding: 10, borderRadius: 20 }}>
                  {gameState.board.map((cell: any, i: number) => (
                    <button
                      key={i} onClick={() => handleTicTacToeMove(i)} disabled={!!gameState.winner || !!cell}
                      style={{ aspectRatio: '1', background: '#fff', borderRadius: 12, border: 'none', fontSize: 44, fontWeight: 900, color: cell === 'X' ? '#0ea5e9' : '#f43f5e', cursor: (gameState.winner || cell) ? 'default' : 'pointer', boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {cell}
                    </button>
                  ))}
                </div>
              )}

              {gameState?.type === 'connect4' && (
                <div style={{ background: '#2563eb', padding: 8, borderRadius: 16, boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {gameState.board.map((row: any, rIndex: number) => 
                      row.map((cell: any, cIndex: number) => (
                        <button
                          key={`${rIndex}-${cIndex}`} onClick={() => handleConnect4Move(cIndex)} disabled={!!gameState.winner}
                          style={{ 
                            aspectRatio: '1', borderRadius: '50%', border: 'none', padding: 0,
                            background: cell === 'P1' ? '#ef4444' : cell === 'P2' ? '#fde047' : '#1e3a8a',
                            boxShadow: cell ? 'inset -2px -4px 6px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)' : 'inset 2px 4px 8px rgba(0,0,0,0.3)',
                            cursor: gameState.winner ? 'default' : 'pointer',
                            pointerEvents: gameState.winner ? 'none' : 'auto'
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {gameState?.type === 'chess' && (
                <div style={{ width: '100%', maxWidth: 360, margin: '0 auto', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <Chessboard 
                    position={gameState.board} 
                    onPieceDrop={handleChessMove}
                    boardOrientation={gameState.p1 === currentUser?.id ? 'white' : 'black'}
                  />
                </div>
              )}
            </div>
            
            <button onClick={() => { 
                setGameActive(false); 
                if(channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
              }} style={{ marginTop: 30, padding: '12px 24px', borderRadius: 20, background: '#fff', border: '2px solid #e2e8f0', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
              Abandon Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
