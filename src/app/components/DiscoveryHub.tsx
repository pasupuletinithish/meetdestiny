import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useApp, type VibeStatus } from '../context/AppContext';
import { Switch } from './ui/switch';
import { MessageCircle, User as UserIcon, EyeOff, Eye, Loader2, Zap, Radio, Users, MapPin, Shield } from 'lucide-react';
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/');
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const checkin = await fetchCurrentCheckin();

      if (!checkin) {
        setHasActiveJourney(false);
        setLoading(false);
        return;
      }

      setHasActiveJourney(true);
      setCurrentCheckin(checkin);
      const expiresAt = new Date(checkin.expires_at).getTime();
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const users = await fetchNearbyUsers(checkin.vehicle_id, user.id);
      setNearbyUsers(users);
      setLoading(false);
    };
    init();
  }, [fetchCurrentCheckin, fetchNearbyUsers]);

  // ── Journey expired — cleanup everything ──────────────────
  const handleJourneyExpired = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }

    // ── Delete entire group room for this vehicle ──
    if (currentCheckin?.vehicle_id) {
      await supabase.from('lounge_messages')
        .delete()
        .eq('vehicle_id', currentCheckin.vehicle_id);
    }

    // ── Delete destination chat ──
    if (currentCheckin?.to_location) {
      await supabase.from('destination_messages')
        .delete()
        .eq('destination', currentCheckin.to_location);
    }

    // ── Delete private messages both ways ──
    await supabase.from('private_messages')
      .delete()
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);

    // ── Deactivate ALL checkins for this vehicle ──
    if (currentCheckin?.vehicle_id) {
      await supabase.from('checkins')
        .update({ is_active: false })
        .eq('vehicle_id', currentCheckin.vehicle_id)
        .eq('is_active', true);
    }

    // ── Check if user has any friends ──
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

  // ── Timer countdown ───────────────────────────────────────
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

  // ── Realtime — new travelers joining ─────────────────────
  useEffect(() => {
    if (!currentCheckin) return;
    const channel = supabase.channel('checkins-rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'checkins',
        filter: `vehicle_id=eq.${currentCheckin.vehicle_id}`
      }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const users = await fetchNearbyUsers(currentCheckin.vehicle_id, user.id);
        setNearbyUsers(users);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, fetchNearbyUsers]);

  // ── Realtime — pings ──────────────────────────────────────
  useEffect(() => {
    if (!currentCheckin) return;
    const channel = supabase.channel('pings-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings' },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          if (payload.new.to_user_id === user.id) {
            const pinger = nearbyUsers.find(u => u.user_id === payload.new.from_user_id);
            if (pinger) {
              toast.success(`${pinger.name} pinged you! 👋`);
              const { data: mutualPing } = await supabase.from('pings').select('*')
                .eq('from_user_id', user.id).eq('to_user_id', payload.new.from_user_id).single();
              if (mutualPing) { setMatchedUser(pinger); setShowMatchModal(true); }
            }
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, nearbyUsers]);

  // ── Invisible mode ────────────────────────────────────────
  useEffect(() => {
    if (!currentCheckin) return;
    supabase.from('checkins').update({ is_active: !invisibleMode }).eq('id', currentCheckin.id);
  }, [invisibleMode, currentCheckin]);

  const handlePing = async (user: CheckinUser) => {
    if (pingedUsers.has(user.id)) { toast.info(`Already pinged ${user.name}`); return; }
    setPingLoading(user.id);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !currentCheckin) return;
    const { error } = await supabase.from('pings').insert({
      from_user_id: authUser.id, to_user_id: user.user_id, checkin_id: currentCheckin.id,
    });
    if (error) { toast.error('Failed to send ping'); }
    else {
      toast.success(`Pinged ${user.name}! 👋`);
      setPingedUsers(prev => new Set([...prev, user.id]));
      notify.ping(user.user_id, currentCheckin.name);
    }
    setPingLoading(null);
  };

  const filteredUsers = professionFilter === 'All'
    ? nearbyUsers
    : nearbyUsers.filter(u => u.profession.toLowerCase().includes(professionFilter.toLowerCase()));

  const totalDuration = currentCheckin
    ? (new Date(currentCheckin.expires_at).getTime() - new Date(currentCheckin.arrival_time).getTime()) / 1000
    : 3 * 3600;
  const progress = Math.max(0, Math.min(1, timeRemaining / (totalDuration || 3 * 3600)));
  const hours = Math.floor(timeRemaining / 3600);
  const mins = Math.floor((timeRemaining % 3600) / 60);
  const secs = timeRemaining % 60;

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

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 300, height: 300, top: '-10%', left: '-20%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 280, height: 280, bottom: '-8%', right: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], x: [0, -15, 0] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* ── TOP BAR ── */}
      <div style={{ position: 'relative', zIndex: 20, padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <motion.div style={{ width: 7, height: 7, borderRadius: '50%', background: hasActiveJourney ? '#22c55e' : '#94a3b8' }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {hasActiveJourney ? 'Live' : 'No Journey'}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.2, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {hasActiveJourney ? currentCheckin?.vehicle_id : 'Destiny'}
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            {hasActiveJourney ? `${currentCheckin?.from_location} → ${currentCheckin?.to_location}` : 'Start a new journey to connect'}
          </p>
        </div>

        {/* Timer */}
        {hasActiveJourney && (
          <div style={{ position: 'relative', width: 58, height: 58, flexShrink: 0 }}>
            <svg width="58" height="58" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1E88E5" />
                  <stop offset="100%" stopColor="#FF6B35" />
                </linearGradient>
              </defs>
              <circle cx="29" cy="29" r="23" fill="none" stroke="rgba(30,136,229,0.12)" strokeWidth="3.5" />
              <circle cx="29" cy="29" r="23" fill="none" stroke="url(#timerGrad)" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={2 * Math.PI * 23 * (1 - progress)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#1E88E5', lineHeight: 1 }}>{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}</span>
              <span style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>{String(secs).padStart(2, '0')}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter pills */}
      {hasActiveJourney && (
        <div style={{ position: 'relative', zIndex: 20, display: 'flex', gap: 8, padding: '0 20px 10px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
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

        {/* ── NO ACTIVE JOURNEY ── */}
        {!hasActiveJourney ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(30,136,229,0.1), rgba(255,107,53,0.1))', border: '2px solid rgba(30,136,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 36 }}>👋</span>
            </motion.div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Welcome back!</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
              You don't have an active journey right now.<br />Ready to meet new travelers?
            </p>
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
          </div>

        ) : filteredUsers.length === 0 ? (
          // ── ACTIVE JOURNEY — NO CO-TRAVELERS ──
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
            <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 20 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid rgba(30,136,229,${0.35 - i * 0.1})` }}
                  animate={{ scale: [1, 2 + i * 0.4], opacity: [0.6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }} />
              ))}
              <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(30,136,229,0.1), rgba(255,107,53,0.1))', border: '1.5px solid rgba(30,136,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                <Radio style={{ width: 28, height: 28, color: '#1E88E5' }} />
              </motion.div>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 6, marginTop: 0 }}>Scanning your route</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
              No travelers on <strong style={{ color: '#1E88E5' }}>{currentCheckin?.vehicle_id}</strong> yet. Be the first!
            </p>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/notify-me')}
              style={{ padding: '12px 24px', borderRadius: 14, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #FF6B35, #E85A2B)', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(255,107,53,0.3)' }}>
              🔔 Notify me when someone joins
            </motion.button>
          </div>

        ) : (
          // ── ACTIVE JOURNEY — TRAVELERS FOUND ──
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
                              Message in Lounge
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

      {/* Nearby Stops + Safety SOS */}
      {hasActiveJourney && (
        <div style={{ display: 'flex', gap: 10, padding: '0 16px 8px', flexShrink: 0, position: 'relative', zIndex: 20 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/nearby-stops')}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 14, border: '1.5px solid rgba(30,136,229,0.15)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MapPin style={{ width: 16, height: 16, color: '#1E88E5' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Nearby Stops</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/safety-sos')}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Shield style={{ width: 16, height: 16, color: '#ef4444' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>Safety SOS</span>
          </motion.button>
        </div>
      )}

      {/* ── BOTTOM ACTION ROW ── */}
      {hasActiveJourney && (
        <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(30,136,229,0.12)', borderRadius: 12, padding: '8px 12px' }}>
            {invisibleMode
              ? <EyeOff style={{ width: 15, height: 15, color: '#94a3b8', flexShrink: 0 }} />
              : <Eye style={{ width: 15, height: 15, color: '#1E88E5', flexShrink: 0 }} />
            }
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', flex: 1 }}>Invisible</span>
            <Switch checked={invisibleMode} onCheckedChange={setInvisibleMode} />
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/lounge')}
            style={{ flex: 1.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FF6B35, #E85A2B)', boxShadow: '0 4px 16px rgba(255,107,53,0.3)' }}>
            <MessageCircle style={{ width: 15, height: 15, color: '#fff' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Join Lounge</span>
          </motion.button>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: true, action: () => {} },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <UserIcon style={{ width: 22, height: 22 }} />, label: 'Profile', active: false, action: () => navigate('/profile') },
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