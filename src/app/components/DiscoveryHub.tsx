import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useApp, type VibeStatus } from '../context/AppContext';
import { Switch } from './ui/switch';
import { MessageCircle, User as UserIcon, EyeOff, Eye, Loader2, Zap, Radio, Users, MapPin, Shield, Flag, Ban, X, Trophy, Gamepad2, CheckCircle } from 'lucide-react';
import { MutualMatchModal } from './MutualMatchModal';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';

const vibeColors: Record<VibeStatus, string> = {
  ready: '#22c55e',
  logistics: '#eab308',
  lurking: '#ef4444',
};

const vibeLabels: Record<VibeStatus, string> = {
  ready: 'Open to chat',
  logistics: 'Logistics only',
  lurking: 'Just lurking',
};

const professionFilters = ['All', 'Software', 'Student', 'UPSC', 'HR'];

const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment or abuse',
  'Fake profile',
  'Spam',
  'Making me uncomfortable',
  'Other',
];

const CONTEST_SCHEDULE = [
  { name: 'All Rounder 🏆', desc: 'Combined score wins', criteria: 'combined' },
  { name: 'Social Butterfly 🦋', desc: 'Send the most pings!', criteria: 'pings_sent' },
  { name: 'Best Connector 🤝', desc: 'Most mutual matches!', criteria: 'mutual_matches' },
  { name: 'Lounge Star 💬', desc: 'Most active in chat!', criteria: 'messages_sent' },
  { name: 'Early Bird 🐦', desc: 'First to check in!', criteria: 'first_checkin' },
  { name: 'Friend Magnet 👥', desc: 'Add the most friends!', criteria: 'friends_added' },
  { name: 'Lucky Draw 🎰', desc: 'Everyone has equal chance!', criteria: 'random' },
];

interface CheckinUser {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  vehicle_id: string;
  from_location: string;
  to_location: string;
  arrival_time: string;
  expires_at: string;
  vibe: VibeStatus;
}

export const DiscoveryHub: React.FC = () => {
  const navigate = useNavigate();
  const { invisibleMode, setInvisibleMode, professionFilter, setProfessionFilter } = useApp();

  const [nearbyUsers, setNearbyUsers] = useState<CheckinUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [matchedUser, setMatchedUser] = useState<CheckinUser | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [currentCheckin, setCurrentCheckin] = useState<CheckinUser | null>(null);
  const [pingLoading, setPingLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CheckinUser | null>(null);
  const [pingedUsers, setPingedUsers] = useState<Set<string>>(new Set());
  const [hasActiveJourney, setHasActiveJourney] = useState(false);
  const [missedConnections, setMissedConnections] = useState<CheckinUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [myScore, setMyScore] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');

  // Report modal
  const [reportTarget, setReportTarget] = useState<CheckinUser | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const todayContest = CONTEST_SCHEDULE[new Date().getDay()];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/');
      else {
        setUserName(user.user_metadata?.full_name || '');
        setUserAvatar(user.user_metadata?.avatar_url || '');
      }
    });
  }, [navigate]);

  const fetchCurrentCheckin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('checkins').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data;
  }, []);

  const fetchNearbyUsers = useCallback(async (vehicleId: string, currentUserId: string) => {
    const { data, error } = await supabase
      .from('checkins').select('*')
      .eq('vehicle_id', vehicleId).eq('is_active', true)
      .neq('user_id', currentUserId);
    if (error) { toast.error('Failed to load nearby users'); return []; }
    return data || [];
  }, []);

  const fetchBlockedUsers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('blocked_users').select('blocker_id, blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    if (data) {
      const blockedSet = new Set<string>();
      data.forEach(d => {
        if (d.blocker_id === user.id) blockedSet.add(d.blocked_id);
        if (d.blocked_id === user.id) blockedSet.add(d.blocker_id);
      });
      setBlockedUsers(blockedSet);
    }
  }, []);

  // ── Calculate live contest score ──────────────────────────
  const calculateMyScore = useCallback(async (vehicleId: string, userId: string) => {
    const criteria = todayContest.criteria;
    let score = 0;

    if (criteria === 'random') {
      score = 1; // everyone participates
    } else if (criteria === 'pings_sent') {
      const { count } = await supabase.from('pings').select('*', { count: 'exact', head: true }).eq('from_user_id', userId);
      score = count || 0;
    } else if (criteria === 'mutual_matches') {
      const { data: sent } = await supabase.from('pings').select('to_user_id').eq('from_user_id', userId);
      const { data: received } = await supabase.from('pings').select('from_user_id').eq('to_user_id', userId);
      const sentIds = sent?.map(p => p.to_user_id) || [];
      const receivedIds = received?.map(p => p.from_user_id) || [];
      score = sentIds.filter(id => receivedIds.includes(id)).length;
    } else if (criteria === 'messages_sent') {
      const { count } = await supabase.from('lounge_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('vehicle_id', vehicleId);
      score = count || 0;
    } else if (criteria === 'first_checkin') {
      const { data: checkins } = await supabase.from('checkins').select('user_id, created_at').eq('vehicle_id', vehicleId).order('created_at', { ascending: true }).limit(1);
      score = checkins?.[0]?.user_id === userId ? 1 : 0;
    } else if (criteria === 'friends_added') {
      const { count } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'accepted');
      score = count || 0;
    } else if (criteria === 'combined') {
      const { count: pings } = await supabase.from('pings').select('*', { count: 'exact', head: true }).eq('from_user_id', userId);
      const { count: msgs } = await supabase.from('lounge_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('vehicle_id', vehicleId);
      const { count: friends } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'accepted');
      score = ((pings || 0) * 5) + ((msgs || 0) * 3) + ((friends || 0) * 15);
    }

    setMyScore(score);
  }, [todayContest]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const checkin = await fetchCurrentCheckin();

      if (!checkin) {
        setHasActiveJourney(false);
        if (user) {
          const { data: pastCheckins } = await supabase.from('checkins').select('*').neq('user_id', user.id).eq('is_active', false).order('created_at', { ascending: false }).limit(6);
          setMissedConnections(pastCheckins || []);
        }
        setLoading(false);
        return;
      }

      setHasActiveJourney(true);
      setCurrentCheckin(checkin);
      const expiresAt = new Date(checkin.expires_at).getTime();
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
      
      if (!user) return;
      const users = await fetchNearbyUsers(checkin.vehicle_id, user.id);
      setNearbyUsers(users);
      await fetchBlockedUsers();
      await calculateMyScore(checkin.vehicle_id, user.id);
      setLoading(false);
    };
    init();
  }, [fetchCurrentCheckin, fetchNearbyUsers, fetchBlockedUsers, calculateMyScore]);

  const handleJourneyExpired = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }

    // ── Pick contest winner before cleanup ────────────────
    if (currentCheckin?.vehicle_id) {
      try {
        // NEW — passes auth token
const { data: { session } } = await supabase.auth.getSession();
await supabase.functions.invoke('pick-winner', {
  body: { vehicle_id: currentCheckin.vehicle_id },
  headers: { Authorization: `Bearer ${session?.access_token}` },
});
      } catch (err) {
        console.error('Failed to pick winner:', err);
      }
    }

    if (currentCheckin?.vehicle_id) {
      await supabase.from('lounge_messages').delete().eq('vehicle_id', currentCheckin.vehicle_id);
    }
    if (currentCheckin?.to_location) {
      await supabase.from('destination_messages').delete().eq('destination', currentCheckin.to_location);
    }
    await supabase.from('private_messages').delete().or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    if (currentCheckin?.vehicle_id) {
      await supabase.from('checkins').update({ is_active: false }).eq('vehicle_id', currentCheckin.vehicle_id).eq('is_active', true);
    }

    const { count } = await supabase
      .from('friends').select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!count || count === 0) {
      toast.info('Journey ended. No connections made — account deleted.', { duration: 5000 });
      await supabase.from('checkins').delete().eq('user_id', user.id);
      await supabase.from('pings').delete().eq('from_user_id', user.id);
      await supabase.from('muted_chats').delete().eq('user_id', user.id);
      await supabase.from('user_profiles').delete().eq('user_id', user.id);
      await supabase.auth.signOut();
      navigate('/');
    } else {
      toast.success('Journey complete! Your connections are saved. 🎉', { duration: 5000 });
      setHasActiveJourney(false);
      setCurrentCheckin(null);
      setTimeRemaining(0);
      setNearbyUsers([]);
    }
  }, [currentCheckin, navigate]);

  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { handleJourneyExpired(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining, handleJourneyExpired]);

  useEffect(() => {
    if (!currentCheckin) return;
    const channel = supabase.channel('checkins-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `vehicle_id=eq.${currentCheckin.vehicle_id}` },
        async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const users = await fetchNearbyUsers(currentCheckin.vehicle_id, user.id);
          setNearbyUsers(users);
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, fetchNearbyUsers]);

  useEffect(() => {
    if (!currentCheckin) return;
    const channel = supabase.channel('pings-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings' },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          if (payload.new.to_user_id === user.id) {
            // Check if user is blocked
            if (blockedUsers.has(payload.new.from_user_id)) return;
            
            const pinger = nearbyUsers.find(u => u.user_id === payload.new.from_user_id);
            if (pinger) {
              toast.success(`${pinger.name} pinged you! 👋`);
              const { data: mutualPing } = await supabase.from('pings').select('*')
                .eq('from_user_id', user.id).eq('to_user_id', payload.new.from_user_id).maybeSingle();
              if (mutualPing) { setMatchedUser(pinger); setShowMatchModal(true); }
            }
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, nearbyUsers, blockedUsers]);

  useEffect(() => {
    if (!currentCheckin) return;
    supabase.from('checkins').update({ is_active: !invisibleMode }).eq('id', currentCheckin.id);
  }, [invisibleMode, currentCheckin]);



  const handlePing = async (user: CheckinUser) => {
    if (pingedUsers.has(user.id)) { toast.info(`Already pinged ${user.name}`); return; }
    setPingLoading(user.id);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !currentCheckin) return;

    // Check if I am banned
    const { data: profile } = await supabase.from('user_profiles').select('is_banned').eq('user_id', authUser.id).maybeSingle();
    if (profile?.is_banned) {
      toast.error('Your account is banned.');
      setPingLoading(null);
      return;
    }

    // ACTIVE PRE-FLIGHT BLOCK CHECK
    const { data: blockRecords } = await supabase.from('blocked_users').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${authUser.id},blocked_id.eq.${authUser.id}`);
    
    const isBlocked = blockRecords?.some(b => b.blocker_id === user.user_id || b.blocked_id === user.user_id);
    
    if (isBlocked) {
      toast.error('Cannot interact with this user');
      setPingLoading(null);
      return;
    }

    const { error } = await supabase.from('pings').insert({
      from_user_id: authUser.id, to_user_id: user.user_id, checkin_id: currentCheckin.id,
    });
    if (error) { toast.error('Failed to send ping'); }
    else {
      toast.success(`Pinged ${user.name}! 👋`);
      setPingedUsers(prev => new Set([...prev, user.id]));
      notify.ping(user.user_id, currentCheckin.name);
      // Refresh score after ping
      await calculateMyScore(currentCheckin.vehicle_id, authUser.id);
    }
    setPingLoading(null);
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason) { toast.error('Please select a reason'); return; }
    setReportLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: reportTarget.user_id,
      reason: reportReason,
      context: `Discovery Hub — Vehicle: ${currentCheckin?.vehicle_id}`,
      status: 'pending',
    });
    if (!error) {
      toast.success(`${reportTarget.name} reported. Our team will review. 🛡️`);
      setReportTarget(null); setReportReason('');
    } else toast.error('Failed to submit report');
    setReportLoading(false);
  };

  const handleBlock = async (targetUser: CheckinUser) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: targetUser.user_id });
    if (!error) {
      setBlockedUsers(prev => new Set([...prev, targetUser.user_id]));
      setNearbyUsers(prev => prev.filter(u => u.user_id !== targetUser.user_id));
      setSelectedUser(null);
      toast.success(`${targetUser.name} blocked.`);
    } else toast.error('Failed to block user');
  };

  const filteredUsers = (professionFilter === 'All'
    ? nearbyUsers
    : nearbyUsers.filter(u => u.profession.toLowerCase().includes(professionFilter.toLowerCase()))
  ).filter(u => !blockedUsers.has(u.user_id));

  const totalDuration = currentCheckin
    ? (new Date(currentCheckin.expires_at).getTime() - new Date(currentCheckin.arrival_time).getTime()) / 1000
    : 3 * 3600;
  const progress = Math.max(0, Math.min(1, timeRemaining / (totalDuration || 3 * 3600)));
  const hours = Math.floor(timeRemaining / 3600);
  const mins = Math.floor((timeRemaining % 3600) / 60);
  const secs = timeRemaining % 60;
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
            {[0, 1].map(i => (
              <motion.div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${i === 0 ? 'rgba(30,136,229,0.4)' : 'rgba(255,107,53,0.4)'}` }}
                animate={{ scale: [1, 1.8], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.8 }} />
            ))}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(30,136,229,0.15), rgba(255,107,53,0.15))' }}>
              <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Finding travelers...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%' }}>

      {/* ── REPORT MODAL ── */}
      <AnimatePresence>
        {reportTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setReportTarget(null)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flag style={{ width: 16, height: 16, color: '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Report {reportTarget.name}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>This will be reviewed by our team</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setReportTarget(null)}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(148,163,184,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: 14, height: 14, color: '#64748b' }} />
                </motion.button>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Select reason</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {REPORT_REASONS.map(reason => (
                  <motion.button key={reason} whileTap={{ scale: 0.98 }} onClick={() => setReportReason(reason)}
                    style={{ padding: '12px 16px', borderRadius: 12, border: reportReason === reason ? '2px solid #ef4444' : '1.5px solid rgba(148,163,184,0.2)', background: reportReason === reason ? 'rgba(239,68,68,0.06)' : '#f8fafc', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: reportReason === reason ? '#dc2626' : '#374151', fontWeight: reportReason === reason ? 600 : 400, transition: 'all 0.15s' }}>
                    {reason}
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleReport} disabled={!reportReason || reportLoading}
                style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: reportReason ? 'pointer' : 'default', background: reportReason ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(148,163,184,0.15)', color: reportReason ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {reportLoading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Flag style={{ width: 16, height: 16 }} />}
                {reportLoading ? 'Submitting...' : 'Submit Report'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 300, height: 300, top: '-10%', left: '-20%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 280, height: 280, bottom: '-8%', right: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], x: [0, -15, 0] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* ── TOP BAR ── */}
      <div style={{ position: 'relative', zIndex: 20, padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>

        {/* Profile avatar top left */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/profile')}
          style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #1E88E5, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: '0 2px 8px rgba(30,136,229,0.3)' }}>
          {userAvatar ? (
            <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{initials || '?'}</span>
          )}
        </motion.button>

        {/* Vehicle + route */}
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 1 }}>
            <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: hasActiveJourney ? '#22c55e' : '#94a3b8' }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {hasActiveJourney ? 'Live' : 'No Journey'}
            </span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.2, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {hasActiveJourney ? currentCheckin?.vehicle_id : 'Destiny'}
          </h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
            {hasActiveJourney ? `${currentCheckin?.from_location} → ${currentCheckin?.to_location}` : 'Start a new journey'}
          </p>
        </div>

        {/* Timer */}
        {hasActiveJourney && (
          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <svg width="52" height="52" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1E88E5" /><stop offset="100%" stopColor="#FF6B35" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(30,136,229,0.12)" strokeWidth="3" />
              <circle cx="26" cy="26" r="20" fill="none" stroke="url(#timerGrad)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={2 * Math.PI * 20 * (1 - progress)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#1E88E5', lineHeight: 1 }}>{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}</span>
              <span style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>{String(secs).padStart(2, '0')}s</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CONTEST BANNER ── */}
      {hasActiveJourney && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/contest')}
          style={{ margin: '0 16px 8px', borderRadius: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative', zIndex: 20, backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(245,158,11,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}>🏆</motion.div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{todayContest.name}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 500 }}>{todayContest.desc}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '4px 12px', borderRadius: 12, fontSize: 15, fontWeight: 800, color: '#fff', display: 'inline-block', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)' }}>{myScore} <span style={{fontSize: 10, fontWeight: 600, opacity: 0.8}}>PTS</span></span>
          </div>
        </motion.div>
      )}

      {/* Filter pills */}
      {hasActiveJourney && (
        <div style={{ position: 'relative', zIndex: 20, display: 'flex', gap: 8, padding: '0 16px 8px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {professionFilters.map(f => (
            <motion.button key={f} whileTap={{ scale: 0.93 }} onClick={() => setProfessionFilter(f)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', border: professionFilter === f ? '1.5px solid rgba(30,136,229,0.5)' : '1.5px solid rgba(30,136,229,0.1)', background: professionFilter === f ? 'rgba(30,136,229,0.12)' : 'rgba(255,255,255,0.6)', color: professionFilter === f ? '#1565C0' : '#94a3b8', backdropFilter: 'blur(8px)', transition: 'all 0.2s', cursor: 'pointer' }}>
              {f}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px 8px', scrollbarWidth: 'none', position: 'relative', zIndex: 10 }}>

        {!hasActiveJourney ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(30,136,229,0.1), rgba(255,107,53,0.1))', border: '2px solid rgba(30,136,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 36 }}>👋</span>
            </motion.div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Welcome back!</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>You don't have an active journey right now.<br />Ready to meet new travelers?</p>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/check-in')}
              style={{ width: '100%', maxWidth: 280, padding: '15px 32px', borderRadius: 16, fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(30,136,229,0.3)', marginBottom: 12 }}>
              🚀 Start New Journey
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/friends')}
              style={{ width: '100%', maxWidth: 280, padding: '12px 24px', borderRadius: 14, fontSize: 13, fontWeight: 600, color: '#1E88E5', background: 'rgba(30,136,229,0.07)', border: '1.5px solid rgba(30,136,229,0.2)', cursor: 'pointer', marginBottom: 10 }}>
              👥 View My Friends
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/profile')}
              style={{ width: '100%', maxWidth: 280, padding: '12px 24px', borderRadius: 14, fontSize: 13, fontWeight: 600, color: '#FF6B35', background: 'rgba(255,107,53,0.07)', border: '1.5px solid rgba(255,107,53,0.2)', cursor: 'pointer' }}>
              👤 My Profile
            </motion.button>

            {/* Missed Connections Section */}
            {missedConnections.length > 0 && (
              <div style={{ marginTop: 32, width: '100%', textAlign: 'left' }}>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <Users size={18} color="#1E88E5" /> Missed Connections
                </h4>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none', margin: '0 -24px', paddingLeft: 24, paddingRight: 24 }}>
                  {missedConnections.map(mu => (
                    <motion.div key={mu.id} whileHover={{ scale: 1.02 }}
                      style={{ minWidth: 140, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(30,136,229,0.1)', padding: '16px 12px', borderRadius: 16, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#fff', fontWeight: 800, fontSize: 18, boxShadow: '0 2px 8px rgba(30,136,229,0.3)' }}>
                        {mu.name[0]}
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mu.name}</p>
                      <p style={{ margin: '0 0 12px', fontSize: 10, color: '#64748b' }}>Route: {mu.vehicle_id}</p>
                      <button onClick={async () => {
                         const { data: { user } } = await supabase.auth.getUser();
                         if (!user) return;
                         await supabase.from('pings').insert({ from_user_id: user.id, to_user_id: mu.user_id, checkin_id: mu.id });
                         toast.success(`Reconnect sent to ${mu.name}!`);
                      }} style={{ width: '100%', padding: '8px', borderRadius: 10, border: 'none', background: 'rgba(30,136,229,0.1)', color: '#1E88E5', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        Reconnect
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

        ) : filteredUsers.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
            <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', border: '1.5px solid #1E88E5' }}
                  animate={{ scale: [1, 3], opacity: [0.6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }} />
              ))}
              <motion.div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', border: '1.5px dashed rgba(255,107,53,0.5)' }}
                animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
              <motion.div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent 70%, rgba(30,136,229,0.1) 90%, rgba(30,136,229,0.4) 100%)' }}
                animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
              <motion.div style={{ position: 'relative', zIndex: 10, width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 25px rgba(30,136,229,0.6), inset 0 2px 6px rgba(255,255,255,0.4)' }}
                animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
                <Radio style={{ width: 24, height: 24, color: '#fff' }} />
              </motion.div>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 6, marginTop: 0 }}>Scanning your route</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
              No travelers on <strong style={{ color: '#1E88E5' }}>{currentCheckin?.vehicle_id}</strong> yet. Be the first!
            </p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/notify-me')}
              style={{ padding: '10px 24px', borderRadius: 30, fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #FF6B35, #E85A2B)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', boxShadow: '0 8px 20px rgba(255,107,53,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>🔔</motion.div>
              Notify on Join
            </motion.button>
          </div>

        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Travelers', value: filteredUsers.length, color: '#1E88E5', bg: 'rgba(30,136,229,0.07)', border: 'rgba(30,136,229,0.15)' },
                { label: 'Open', value: filteredUsers.filter(u => (u.vibe || 'ready') === 'ready').length, color: '#FF6B35', bg: 'rgba(255,107,53,0.07)', border: 'rgba(255,107,53,0.15)' },
                { label: 'Pinged', value: pingedUsers.size, color: '#16a34a', bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.15)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '8px 10px', backdropFilter: 'blur(8px)' }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>

            <AnimatePresence mode="popLayout">
              {filteredUsers.map((user, index) => {
                const initials = user.name.split(' ').map((n: string) => n[0]).join('');
                const isPinged = pingedUsers.has(user.id);
                const isSelected = selectedUser?.id === user.id;
                const vibe = user.vibe || 'ready';

                return (
                  <motion.div key={user.id}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedUser(isSelected ? null : user)}
                    style={{ marginBottom: 10, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: isSelected ? 'rgba(30,136,229,0.06)' : 'rgba(255,255,255,0.75)', border: isSelected ? '1.5px solid rgba(30,136,229,0.3)' : '1.5px solid rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', boxShadow: isSelected ? '0 4px 20px rgba(30,136,229,0.1)' : '0 2px 10px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${vibeColors[vibe]}` }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{initials}</span>
                        </div>
                        <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                          style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: vibeColors[vibe], border: '2px solid white' }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{user.profession}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: vibeColors[vibe], fontWeight: 500 }}>{vibeLabels[vibe]}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{user.to_location}</p>
                          <p style={{ fontSize: 11, color: '#1E88E5', fontWeight: 700, margin: 0 }}>{user.arrival_time}</p>
                        </div>
                        <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }}
                          onClick={e => { e.stopPropagation(); handlePing(user); }}
                          disabled={pingLoading === user.id}
                          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isPinged ? 'rgba(22,163,74,0.12)' : 'rgba(255,107,53,0.1)', color: isPinged ? '#16a34a' : '#FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isPinged ? '0 0 10px rgba(22,163,74,0.2)' : '0 0 10px rgba(255,107,53,0.15)', transition: 'all 0.2s' }}>
                          {pingLoading === user.id ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Zap style={{ width: 14, height: 14 }} fill={isPinged ? '#16a34a' : 'none'} />}
                        </motion.button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ borderTop: '1px solid rgba(30,136,229,0.1)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', gap: 8, padding: '10px 14px' }}>
                            <motion.button whileTap={{ scale: 0.96 }}
                              onClick={e => { e.stopPropagation(); navigate('/profile', { state: { user } }); }}
                              style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#1565C0', background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.18)', cursor: 'pointer' }}>
                              View Profile
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.96 }}
                              onClick={e => { e.stopPropagation(); navigate('/lounge'); }}
                              style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#E85A2B', background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.18)', cursor: 'pointer' }}>
                              Message
                            </motion.button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px' }}>
                            <motion.button whileTap={{ scale: 0.96 }}
                              onClick={e => { e.stopPropagation(); setReportTarget(user); setReportReason(''); }}
                              style={{ flex: 1, padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                              <Flag style={{ width: 12, height: 12 }} /> Report
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.96 }}
                              onClick={e => { e.stopPropagation(); handleBlock(user); }}
                              style={{ flex: 1, padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#64748b', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                              <Ban style={{ width: 12, height: 12 }} /> Block
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── QUICK ACTIONS DOCK ── */}
      {hasActiveJourney && (
        <div style={{ position: 'relative', zIndex: 20, padding: '12px 16px 14px', background: 'linear-gradient(to top, rgba(238,246,255,1) 0%, rgba(255,255,255,0.8) 100%)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.5)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} onClick={() => navigate('/nearby-stops')}
            style={{ width: 46, height: 46, borderRadius: 16, border: '1px solid rgba(30,136,229,0.2)', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(30,136,229,0.1)', flexShrink: 0 }}>
            <MapPin style={{ width: 22, height: 22, color: '#1E88E5' }} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} onClick={() => navigate('/safety-sos')}
            style={{ width: 46, height: 46, borderRadius: 16, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(239,68,68,0.1)', flexShrink: 0 }}>
            <Shield style={{ width: 22, height: 22, color: '#ef4444' }} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} onClick={() => setInvisibleMode(!invisibleMode)}
            style={{ width: 46, height: 46, borderRadius: 16, border: invisibleMode ? '1px solid rgba(148,163,184,0.3)' : '1px solid rgba(30,136,229,0.3)', background: invisibleMode ? 'rgba(241,245,249,0.9)' : 'rgba(240,249,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative', flexShrink: 0 }}>
            <AnimatePresence mode="wait">
              {invisibleMode ? (
                <motion.div key="off" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                  <EyeOff style={{ width: 22, height: 22, color: '#94a3b8' }} />
                </motion.div>
              ) : (
                <motion.div key="on" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                  <Eye style={{ width: 22, height: 22, color: '#1E88E5' }} />
                </motion.div>
              )}
            </AnimatePresence>
            {!invisibleMode && <motion.div style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} />}
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/lounge')}
            style={{ flex: 1, height: 46, borderRadius: 16, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #1E88E5, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 15px rgba(30,136,229,0.3)' }}>
            <MessageCircle style={{ width: 20, height: 20, color: '#fff' }} fill="white" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Join Lounge</span>
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ marginLeft: 2, display: 'flex', alignItems: 'center' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </motion.div>
          </motion.button>

        </div>
      )}

      {/* ── BOTTOM NAV — Profile replaced with Contest ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: true, action: () => {} },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <Gamepad2 style={{ width: 22, height: 22 }} />, label: 'Activities', active: false, action: () => navigate('/activities') },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: item.active ? '#1E88E5' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, letterSpacing: '0.04em' }}>{item.label}</span>
            {item.active && <motion.div layoutId="nav-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#1E88E5', marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>

      {matchedUser && (
        <MutualMatchModal open={showMatchModal} onClose={() => setShowMatchModal(false)} matchedUser={matchedUser} />
      )}


    </div>
  );
};