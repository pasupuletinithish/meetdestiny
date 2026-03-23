import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ArrowLeft, Radio, MessageCircle, Users, Medal, Star, Clock, Gift, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

const CONTEST_SCHEDULE = [
  { name: 'All Rounder', emoji: '🏆', desc: 'Combined score wins', criteria: 'combined', color: '#f59e0b' },
  { name: 'Social Butterfly', emoji: '🦋', desc: 'Send the most pings!', criteria: 'pings_sent', color: '#1E88E5' },
  { name: 'Best Connector', emoji: '🤝', desc: 'Most mutual matches!', criteria: 'mutual_matches', color: '#8b5cf6' },
  { name: 'Lounge Star', emoji: '💬', desc: 'Most active in chat!', criteria: 'messages_sent', color: '#FF6B35' },
  { name: 'Early Bird', emoji: '🐦', desc: 'First to check in!', criteria: 'first_checkin', color: '#22c55e' },
  { name: 'Friend Magnet', emoji: '👥', desc: 'Add the most friends!', criteria: 'friends_added', color: '#ec4899' },
  { name: 'Lucky Draw', emoji: '🎰', desc: 'Everyone has equal chance!', criteria: 'random', color: '#14b8a6' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface LeaderboardEntry {
  user_id: string;
  name: string;
  score: number;
  rank: number;
}

interface PastWin {
  id: string;
  contest_type: string;
  vehicle_id: string;
  score: number;
  journey_date: string;
  email_sent: boolean;
  created_at: string;
}

export const ContestPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'wins'>('live');
  const [loading, setLoading] = useState(true);
  const [currentCheckin, setCurrentCheckin] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [pastWins, setPastWins] = useState<PastWin[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState('');
  const [loadingBoard, setLoadingBoard] = useState(false);

  const todayContest = CONTEST_SCHEDULE[new Date().getDay()];

  const fetchCurrentCheckin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    setUserId(user.id);
    setUserName(user.user_metadata?.full_name || '');
    const { data } = await supabase
      .from('checkins').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    return data;
  }, []);

  const calculateScore = useCallback(async (vehicleId: string, uid: string, criteria: string): Promise<number> => {
    let score = 0;
    if (criteria === 'random') { score = 1; }
    else if (criteria === 'pings_sent') {
      const { count } = await supabase.from('pings').select('*', { count: 'exact', head: true }).eq('from_user_id', uid);
      score = count || 0;
    } else if (criteria === 'mutual_matches') {
      const { data: sent } = await supabase.from('pings').select('to_user_id').eq('from_user_id', uid);
      const { data: received } = await supabase.from('pings').select('from_user_id').eq('to_user_id', uid);
      const sentIds = sent?.map((p: any) => p.to_user_id) || [];
      const receivedIds = received?.map((p: any) => p.from_user_id) || [];
      score = sentIds.filter((id: string) => receivedIds.includes(id)).length;
    } else if (criteria === 'messages_sent') {
      const { count } = await supabase.from('lounge_messages').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('vehicle_id', vehicleId);
      score = count || 0;
    } else if (criteria === 'first_checkin') {
      const { data: checkins } = await supabase.from('checkins').select('user_id, created_at').eq('vehicle_id', vehicleId).order('created_at', { ascending: true }).limit(1);
      score = checkins?.[0]?.user_id === uid ? 1 : 0;
    } else if (criteria === 'friends_added') {
      const { count } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${uid},receiver_id.eq.${uid}`).eq('status', 'accepted');
      score = count || 0;
    } else if (criteria === 'combined') {
      const { count: pings } = await supabase.from('pings').select('*', { count: 'exact', head: true }).eq('from_user_id', uid);
      const { count: msgs } = await supabase.from('lounge_messages').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('vehicle_id', vehicleId);
      const { count: friends } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${uid},receiver_id.eq.${uid}`).eq('status', 'accepted');
      score = ((pings || 0) * 5) + ((msgs || 0) * 3) + ((friends || 0) * 15);
    }
    return score;
  }, []);

  const buildLeaderboard = useCallback(async (vehicleId: string, criteria: string, currentUserId: string) => {
    setLoadingBoard(true);
    try {
      // Get all travelers on same vehicle
      const { data: checkins } = await supabase
        .from('checkins').select('user_id, name')
        .eq('vehicle_id', vehicleId).eq('is_active', true);

      if (!checkins || checkins.length === 0) { setLeaderboard([]); setLoadingBoard(false); return; }

      // Calculate score for each traveler
      const entries: LeaderboardEntry[] = await Promise.all(
        checkins.map(async (c: any, i: number) => {
          const score = await calculateScore(vehicleId, c.user_id, criteria);
          return { user_id: c.user_id, name: c.name, score, rank: 0 };
        })
      );

      // Sort and assign ranks
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((e, i) => { e.rank = i + 1; });

      setLeaderboard(entries);

      // Find my rank and score
      const mine = entries.find(e => e.user_id === currentUserId);
      if (mine) { setMyScore(mine.score); setMyRank(mine.rank); }
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoadingBoard(false);
    }
  }, [calculateScore]);

  const fetchPastWins = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('contest_winners').select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    setPastWins(data || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const checkin = await fetchCurrentCheckin();
      setCurrentCheckin(checkin);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      if (checkin) {
        await buildLeaderboard(checkin.vehicle_id, todayContest.criteria, user.id);
      }
      await fetchPastWins(user.id);
      setLoading(false);
    };
    init();
  }, [fetchCurrentCheckin, buildLeaderboard, fetchPastWins, navigate, todayContest.criteria]);

  // Refresh leaderboard every 30 seconds
  useEffect(() => {
    if (!currentCheckin || !userId) return;
    const interval = setInterval(() => {
      buildLeaderboard(currentCheckin.vehicle_id, todayContest.criteria, userId);
    }, 30000);
    return () => clearInterval(interval);
  }, [currentCheckin, userId, todayContest.criteria, buildLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#f59e0b';
    if (rank === 2) return '#94a3b8';
    if (rank === 3) return '#b45309';
    return '#64748b';
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fef3c7, #fff, #fef9c3)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ fontSize: 48, marginBottom: 16 }}>🏆</motion.div>
        <p style={{ color: '#92400e', fontSize: 13, fontWeight: 600 }}>Loading contest...</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #fef3c7 0%, #ffffff 40%, #fef9c3 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${todayContest.color}, ${todayContest.color}cc)`, padding: '16px 16px 0', position: 'relative', overflow: 'hidden' }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.15 }}>{todayContest.emoji}</div>

        {/* Back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/discovery')}
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#fff' }} />
          </motion.button>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Today's Contest</p>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{todayContest.emoji} {todayContest.name}</h1>
          </div>
        </div>

        {/* My score card */}
        {currentCheckin && (
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '16px 16px 0 0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Score</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>{myScore}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>{todayContest.desc}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              {myRank !== null ? (
                <>
                  <p style={{ fontSize: 36, margin: 0, lineHeight: 1 }}>{getRankIcon(myRank)}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0' }}>Your Rank</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 28, margin: 0 }}>🎯</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0' }}>Start playing!</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', borderRadius: currentCheckin ? 0 : '0 0 0 0', marginTop: currentCheckin ? 0 : 16 }}>
          {[
            { id: 'live', label: '🔴 Live' },
            { id: 'schedule', label: '📅 Schedule' },
            { id: 'wins', label: `🏆 My Wins${pastWins.length > 0 ? ` (${pastWins.length})` : ''}` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', transition: 'all 0.2s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <AnimatePresence mode="wait">

          {/* ── LIVE LEADERBOARD ── */}
          {activeTab === 'live' && (
            <motion.div key="live" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: '16px' }}>

              {!currentCheckin ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <p style={{ fontSize: 48, marginBottom: 16 }}>🚌</p>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>No Active Journey</h3>
                  <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>Start a journey to participate in today's contest and win food coupons!</p>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/check-in')}
                    style={{ padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${todayContest.color}, ${todayContest.color}cc)`, border: 'none', cursor: 'pointer', boxShadow: `0 8px 24px ${todayContest.color}40` }}>
                    🚀 Start a Journey
                  </motion.button>
                </div>
              ) : loadingBoard ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <Loader2 style={{ width: 32, height: 32, color: todayContest.color, margin: '0 auto 12px' }} className="animate-spin" />
                  <p style={{ fontSize: 13, color: '#64748b' }}>Building leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <p style={{ fontSize: 48, marginBottom: 16 }}>👻</p>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>No co-travelers yet</h3>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>You're the only one on <strong>{currentCheckin?.vehicle_id}</strong>. Be the first to score!</p>
                </div>
              ) : (
                <>
                  {/* Prize info */}
                  <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '1.5px solid #fcd34d', borderRadius: 16, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>🍕</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>Winner gets a food coupon!</p>
                      <p style={{ fontSize: 12, color: '#a16207', margin: '2px 0 0' }}>Top scorer when journey ends wins. Keep playing!</p>
                    </div>
                  </div>

                  {/* Leaderboard */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leaderboard.map((entry, index) => {
                      const isMe = entry.user_id === userId;
                      const initials = entry.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                      return (
                        <motion.div key={entry.user_id}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{
                            background: isMe ? `rgba(${todayContest.color === '#f59e0b' ? '245,158,11' : todayContest.color === '#1E88E5' ? '30,136,229' : '255,107,53'},0.08)` : '#fff',
                            border: isMe ? `2px solid ${todayContest.color}40` : '1.5px solid #f1f5f9',
                            borderRadius: 16, padding: '12px 14px',
                            display: 'flex', alignItems: 'center', gap: 12,
                            boxShadow: entry.rank === 1 ? '0 4px 16px rgba(245,158,11,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                          }}>

                          {/* Rank */}
                          <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                            {entry.rank <= 3 ? (
                              <span style={{ fontSize: 22 }}>{getRankIcon(entry.rank)}</span>
                            ) : (
                              <span style={{ fontSize: 14, fontWeight: 800, color: getRankColor(entry.rank) }}>#{entry.rank}</span>
                            )}
                          </div>

                          {/* Avatar */}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${todayContest.color}, ${todayContest.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: entry.rank === 1 ? `0 0 0 2px white, 0 0 0 3.5px ${todayContest.color}` : 'none' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{initials}</span>
                          </div>

                          {/* Name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: isMe ? 800 : 600, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.name} {isMe && <span style={{ fontSize: 11, color: todayContest.color, fontWeight: 700 }}>(You)</span>}
                            </p>
                            {entry.rank === 1 && <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, margin: '2px 0 0' }}>🏆 Leading!</p>}
                          </div>

                          {/* Score */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 22, fontWeight: 900, color: getRankColor(entry.rank), margin: 0, lineHeight: 1 }}>{entry.score}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase' }}>pts</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* How to score */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '14px', marginTop: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>How to score today</p>
                    {todayContest.criteria === 'pings_sent' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>⚡ Ping other travelers — each ping = 1 point. Most pings wins!</p>
                    )}
                    {todayContest.criteria === 'mutual_matches' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>🤝 Ping someone who pings you back = 1 mutual match point!</p>
                    )}
                    {todayContest.criteria === 'messages_sent' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>💬 Chat in the Lounge — each message = 1 point!</p>
                    )}
                    {todayContest.criteria === 'first_checkin' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>🐦 First person to check in on this bus wins automatically!</p>
                    )}
                    {todayContest.criteria === 'friends_added' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>👥 Add travelers as friends — each friend = 1 point!</p>
                    )}
                    {todayContest.criteria === 'random' && (
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>🎰 Just check in — everyone has an equal random chance to win!</p>
                    )}
                    {todayContest.criteria === 'combined' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>⚡ Ping = 5 pts</p>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>💬 Lounge message = 3 pts</p>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>👥 Friend added = 15 pts</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── WEEKLY SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: '16px' }}>

              <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1.5px solid #f1f5f9', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                {CONTEST_SCHEDULE.map((contest, i) => {
                  const isToday = new Date().getDay() === i;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < 6 ? '1px solid #f1f5f9' : 'none', background: isToday ? `${contest.color}10` : 'transparent', position: 'relative' }}>

                      {isToday && (
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: contest.color, borderRadius: '0 2px 2px 0' }} />
                      )}

                      <div style={{ width: 44, height: 44, borderRadius: 14, background: isToday ? contest.color : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {contest.emoji}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: isToday ? contest.color : '#0f172a', margin: 0 }}>{contest.name}</p>
                          {isToday && <span style={{ fontSize: 10, background: contest.color, color: '#fff', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>TODAY</span>}
                        </div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{contest.desc}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', fontWeight: 600 }}>{DAY_NAMES[i]}</p>
                      </div>

                      {isToday && <ChevronRight style={{ width: 16, height: 16, color: contest.color, flexShrink: 0 }} />}
                    </motion.div>
                  );
                })}
              </div>

              <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '1.5px solid #fcd34d', borderRadius: 16, padding: '16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: '0 0 8px' }}>🎁 Prize</p>
                <p style={{ fontSize: 13, color: '#a16207', margin: 0, lineHeight: 1.6 }}>
                  Each journey's top performer wins a <strong>food coupon</strong> sent directly to their email. New winner every journey, every day!
                </p>
              </div>
            </motion.div>
          )}

          {/* ── MY WINS ── */}
          {activeTab === 'wins' && (
            <motion.div key="wins" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: '16px' }}>

              {pastWins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <p style={{ fontSize: 56, marginBottom: 16 }}>🏆</p>
                  </motion.div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>No wins yet!</h3>
                  <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                    Participate in today's contest and become the top traveler to win a food coupon!
                  </p>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setActiveTab('live')}
                    style={{ padding: '12px 24px', borderRadius: 14, fontSize: 14, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${todayContest.color}, ${todayContest.color}cc)`, border: 'none', cursor: 'pointer' }}>
                    View Live Leaderboard
                  </motion.button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Total wins summary */}
                  <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fff7ed)', border: '1.5px solid #fcd34d', borderRadius: 16, padding: '16px', display: 'flex', gap: 16, marginBottom: 4 }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <p style={{ fontSize: 28, fontWeight: 900, color: '#d97706', margin: 0 }}>{pastWins.length}</p>
                      <p style={{ fontSize: 11, color: '#92400e', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Total Wins</p>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <p style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', margin: 0 }}>{pastWins.filter(w => w.email_sent).length}</p>
                      <p style={{ fontSize: 11, color: '#15803d', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Coupons Sent</p>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <p style={{ fontSize: 28, margin: 0 }}>🏆</p>
                      <p style={{ fontSize: 11, color: '#92400e', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Champion</p>
                    </div>
                  </div>

                  {pastWins.map((win, index) => {
                    const contestInfo = CONTEST_SCHEDULE.find(c => c.name === win.contest_type.replace(/\s[^\s]+$/, '')) || CONTEST_SCHEDULE[0];
                    return (
                      <motion.div key={win.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                        style={{ background: '#fff', border: '1.5px solid #fef3c7', borderRadius: 16, padding: '14px', boxShadow: '0 2px 8px rgba(245,158,11,0.08)' }}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                            🏆
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{win.contest_type}</p>
                            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Bus: {win.vehicle_id} • Score: {win.score} pts</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                              {new Date(win.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            {win.email_sent ? (
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 18, margin: 0 }}>✉️</p>
                                <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, margin: '2px 0 0' }}>Coupon Sent!</p>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 18, margin: 0 }}>⏳</p>
                                <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, margin: '2px 0 0' }}>Pending</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <Trophy style={{ width: 22, height: 22 }} />, label: 'Contest', active: true, action: () => {} },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: item.active ? todayContest.color : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, letterSpacing: '0.04em' }}>{item.label}</span>
            {item.active && <motion.div layoutId="nav-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: todayContest.color, marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>
    </div>
  );
};