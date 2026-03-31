import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Briefcase, MapPin, Bus, Zap, MessageCircle,
  Radio, UserIcon as UserIcon, LogOut, RefreshCw, Trash2,
  Shield, ChevronRight, Loader2, Clock, Users, Gamepad2, UserPlus, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';
import { NotificationSettings } from './NotificationSettings';
import { AdSlot } from './AdSlot';

type VibeStatus = 'ready' | 'logistics' | 'lurking';

const vibeOptions = [
  { value: 'ready' as VibeStatus, label: 'Open to chat', color: '#22c55e', emoji: '🟢' },
  { value: 'logistics' as VibeStatus, label: 'Logistics only', color: '#eab308', emoji: '🟡' },
  { value: 'lurking' as VibeStatus, label: 'Just lurking', color: '#ef4444', emoji: '🔴' },
];

interface CheckinData {
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

interface UserProfileData {
  name: string;
  profession: string;
  total_journeys: number;
}

function ProfileBanner({ name, profession, vibe, isOwn }: {
  name: string; profession: string; vibe: typeof vibeOptions[0]; isOwn: boolean;
}) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

  return (
    <AdSlot variant="cover">
      <div style={{ paddingTop: 46, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 10 }}>
        {/* Profile Info Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: `2px solid ${vibe.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{initials}</span>
            </div>
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: vibe.color, border: '2px solid white', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {vibe.emoji}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{name}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{profession}</p>
          </div>
        </div>
        
        {/* Right side labels */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
           {isOwn && (
             <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '3px 8px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
               <span style={{ fontSize: 9, color: '#fff', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>You</span>
             </div>
           )}
           <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '3px 8px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
             <div style={{ width: 5, height: 5, borderRadius: '50%', background: vibe.color, boxShadow: `0 0 6px ${vibe.color}` }} />
             <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{vibe.label}</span>
           </div>
        </div>
      </div>
    </AdSlot>
  );
}

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const viewingCheckin: CheckinData | null = location.state?.user || null;
  const isOwnProfile = !viewingCheckin;

  const [loading, setLoading] = useState(true);
  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [vibe, setVibe] = useState<VibeStatus>('ready');
  const [friendsCount, setFriendsCount] = useState(0);
  const [pingLoading, setPingLoading] = useState(false);
  const [alreadyPinged, setAlreadyPinged] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setCurrentUserId(user.id);
      if (isOwnProfile) {
        const { data: checkin } = await supabase.from('checkins').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (checkin) { setCurrentCheckin(checkin); setVibe(checkin.vibe || 'ready'); setTimeRemaining(Math.max(0, Math.floor((new Date(checkin.expires_at).getTime() - Date.now()) / 1000))); }
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        setProfileData(profile);
        const { count } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted');
        setFriendsCount(count || 0);
      } else {
        const { data: existingPing } = await supabase.from('pings').select('id').eq('from_user_id', user.id).eq('to_user_id', viewingCheckin!.user_id).maybeSingle();
        setAlreadyPinged(!!existingPing);
        
        const { data: existingFriend } = await supabase.from('friends').select('status')
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${viewingCheckin!.user_id}),and(requester_id.eq.${viewingCheckin!.user_id},receiver_id.eq.${user.id})`)
          .maybeSingle();

        if (existingFriend) {
          if (existingFriend.status === 'accepted') setIsFriend(true);
          else setFriendRequested(true);
        }
      }
      setLoading(false);
    };
    init();
  }, [navigate, isOwnProfile, viewingCheckin]);

  useEffect(() => {
    if (!isOwnProfile || timeRemaining <= 0) return;
    const timer = setInterval(() => setTimeRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeRemaining, isOwnProfile]);

  const handleVibeChange = async (newVibe: VibeStatus) => {
    if (!currentCheckin) return;
    setVibe(newVibe);
    const { error } = await supabase.from('checkins').update({ vibe: newVibe }).eq('id', currentCheckin.id);
    if (error) toast.error('Failed to update vibe'); else toast.success('Vibe updated!');
  };

  const handlePing = async () => {
    if (!viewingCheckin || !currentUserId || alreadyPinged) return;
    setPingLoading(true);

    // Check if I am banned
    const { data: profile } = await supabase.from('user_profiles').select('is_banned').eq('user_id', currentUserId).maybeSingle();
    if (profile?.is_banned) {
      toast.error('Your account is banned.');
      setPingLoading(false);
      return;
    }

    // ACTIVE PRE-FLIGHT BLOCK CHECK
    const { data: blockRecords } = await supabase.from('blocked_users').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`);

    const isBlocked = blockRecords?.some(b => b.blocker_id === viewingCheckin.user_id || b.blocked_id === viewingCheckin.user_id);

    if (isBlocked) {
      toast.error('Cannot interact with this user');
      setPingLoading(false);
      return;
    }

    const { data: myCheckin } = await supabase.from('checkins').select('id, name').eq('user_id', currentUserId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from('pings').insert({ from_user_id: currentUserId, to_user_id: viewingCheckin.user_id, checkin_id: myCheckin?.id });
    if (error) { toast.error('Failed to send ping'); }
    else {
      setAlreadyPinged(true);
      toast.success(`Pinged ${viewingCheckin.name}! 👋`);
      notify.ping(viewingCheckin.user_id, myCheckin?.name || 'Someone');
    }
    setPingLoading(false);
  };

  const handleAddFriend = async () => {
    if (!viewingCheckin || !currentUserId) return;
    setFriendLoading(true);
    try {
      const { data: myCheckin } = await supabase
        .from('checkins').select('name, profession, vehicle_id')
        .eq('user_id', currentUserId).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
        
      if (!myCheckin) {
        toast.error('You need an active journey to add friends');
        return;
      }

      const { error } = await supabase.from('friends').insert({
        requester_id: currentUserId,
        receiver_id: viewingCheckin.user_id,
        requester_name: myCheckin.name,
        receiver_name: viewingCheckin.name,
        requester_profession: myCheckin.profession,
        receiver_profession: viewingCheckin.profession,
        connected_on_vehicle: myCheckin.vehicle_id || viewingCheckin.vehicle_id || '',
        status: 'pending',
      });

      if (error) throw error;
      setFriendRequested(true);
      toast.success(`Friend request sent to ${viewingCheckin.name}! 🎉`);
      notify.friendRequest(viewingCheckin.user_id, myCheckin.name);
    } catch {
      toast.error('Failed to send friend request');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); toast.success('Signed out'); navigate('/'); };

  const handleNewJourney = async () => {
    if (currentCheckin) await supabase.from('checkins').update({ is_active: false }).eq('id', currentCheckin.id);
    navigate('/check-in');
  };

  const handleDeleteAccount = async () => {
    if (!currentUserId) return;
    setDeleteLoading(true);
    try {
      await supabase.from('checkins').delete().eq('user_id', currentUserId);
      await supabase.from('pings').delete().eq('from_user_id', currentUserId);
      await supabase.from('friends').delete().or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
      await supabase.from('user_profiles').delete().eq('user_id', currentUserId);
      await supabase.from('lounge_messages').delete().eq('user_id', currentUserId);
      await supabase.from('private_messages').delete().eq('from_user_id', currentUserId);
      await supabase.from('muted_chats').delete().eq('user_id', currentUserId);
      await supabase.auth.signOut();
      toast.success('Account deleted'); navigate('/');
    } catch { toast.error('Failed to delete account'); setDeleteLoading(false); }
  };

  const formatTime = (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`; };

  const displayCheckin = isOwnProfile ? currentCheckin : viewingCheckin;
  const displayName = displayCheckin?.name || profileData?.name || 'Traveler';
  const displayProfession = displayCheckin?.profession || profileData?.profession || '';
  const displayVibe = isOwnProfile ? vibe : (viewingCheckin?.vibe || 'ready');
  const vibeOption = vibeOptions.find(v => v.value === displayVibe) || vibeOptions[0];

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
      <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
    </div>
  );

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative' }}>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 280, height: 280, top: '-8%', left: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.08) 0%, transparent 70%)' }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 240, height: 240, bottom: '-6%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)' }} animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 10 }}>

        {/* Back button */}
        <div style={{ padding: '14px 16px 0', position: 'absolute', top: 0, left: 0, zIndex: 30 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
            <ArrowLeft style={{ width: 14, height: 14, color: '#fff' }} />
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Back</span>
          </motion.button>
        </div>

        <ProfileBanner name={displayName} profession={displayProfession} vibe={vibeOption} isOwn={isOwnProfile} />

        <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Stats */}
          {isOwnProfile && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Friends', value: friendsCount, color: '#1E88E5', bg: 'rgba(30,136,229,0.07)', border: 'rgba(30,136,229,0.15)', icon: <Users style={{ width: 13, height: 13 }} /> },
                { label: 'Journeys', value: profileData?.total_journeys || 1, color: '#FF6B35', bg: 'rgba(255,107,53,0.07)', border: 'rgba(255,107,53,0.15)', icon: <Bus style={{ width: 13, height: 13 }} /> },
                { label: 'Time left', value: formatTime(timeRemaining), color: '#7c3aed', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.15)', icon: <Clock style={{ width: 13, height: 13 }} />, small: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 14, padding: '10px 8px 8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', color: s.color, marginBottom: 3 }}>{s.icon}</div>
                  <p style={{ fontSize: (s as any).small ? 12 : 19, fontWeight: 800, color: s.color, margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Badges / Milestones */}
          {isOwnProfile && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Milestones</p>
                <button onClick={() => navigate('/leaderboard')} style={{ fontSize: 10, color: '#1E88E5', background: 'rgba(30,136,229,0.1)', padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  Leaderboard
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {[
                  { icon: '⭐', name: 'First Trip', color: '#10b981' },
                  { icon: '🏆', name: 'Top 10%', color: '#f59e0b' },
                  { icon: '🎮', name: 'Gamer', color: '#8b5cf6' },
                  { icon: '🤝', name: 'Connector', color: '#0ea5e9' }
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${b.color}15`, border: `2px solid ${b.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      {b.icon}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'center', lineHeight: 1.1 }}>{b.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Account warning */}
          {isOwnProfile && friendsCount === 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              style={{ background: 'rgba(255,107,53,0.06)', border: '1.5px solid rgba(255,107,53,0.2)', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#E85A2B', margin: '0 0 2px' }}>Account deletes after journey ends</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>Add at least one friend to keep your account.</p>
              </div>
            </motion.div>
          )}

          {/* Vibe selector */}
          {isOwnProfile && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px', backdropFilter: 'blur(12px)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Your Vibe</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {vibeOptions.map(option => (
                  <motion.button key={option.value} whileTap={{ scale: 0.98 }} onClick={() => handleVibeChange(option.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, cursor: 'pointer', background: vibe === option.value ? `${option.color}12` : 'rgba(248,250,252,0.8)', border: `1.5px solid ${vibe === option.value ? option.color+'50' : 'rgba(226,232,240,0.8)'}`, transition: 'all 0.2s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: option.color+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{option.emoji}</div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'left' }}>{option.label}</span>
                    {vibe === option.value && <div style={{ width: 18, height: 18, borderRadius: '50%', background: option.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</span></div>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Journey details */}
          {displayCheckin && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px', backdropFilter: 'blur(12px)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 11px' }}>Journey Details</p>
              {[
                { icon: <Bus style={{ width: 15, height: 15, color: '#1E88E5' }} />, bg: 'rgba(30,136,229,0.1)', label: 'Vehicle', value: displayCheckin.vehicle_id },
                { icon: <MapPin style={{ width: 15, height: 15, color: '#FF6B35' }} />, bg: 'rgba(255,107,53,0.1)', label: 'Route', value: `${displayCheckin.from_location} → ${displayCheckin.to_location}` },
                { icon: <Clock style={{ width: 15, height: 15, color: '#7c3aed' }} />, bg: 'rgba(124,58,237,0.1)', label: 'Arriving', value: displayCheckin.arrival_time },
                { icon: <Briefcase style={{ width: 15, height: 15, color: '#16a34a' }} />, bg: 'rgba(22,163,74,0.1)', label: 'Profession', value: displayCheckin.profession },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: i < 3 ? 10 : 0, paddingBottom: i < 3 ? 10 : 0, borderBottom: i < 3 ? '1px solid rgba(226,232,240,0.6)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                  <div><p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 1px' }}>{item.label}</p><p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{item.value}</p></div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Lite profile badge */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ background: 'linear-gradient(135deg, rgba(30,136,229,0.07), rgba(255,107,53,0.07))', border: '1.5px solid rgba(30,136,229,0.12)', borderRadius: 16, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield style={{ width: 16, height: 16, color: '#1E88E5' }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 1px' }}>✨ Lite Profile</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>Minimal info — your privacy is protected.</p>
            </div>
          </motion.div>

          {/* Actions — other user */}
          {!isOwnProfile && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddFriend}
                disabled={isFriend || friendRequested || friendLoading}
                style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: (isFriend || friendRequested) ? 'default' : 'pointer', background: (isFriend || friendRequested) ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg, #1E88E5, #1565C0)', boxShadow: (isFriend || friendRequested) ? 'none' : '0 6px 20px rgba(30,136,229,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {friendLoading ? <Loader2 style={{ width: 17, height: 17, color: '#fff' }} className="animate-spin" /> : <UserPlus style={{ width: 17, height: 17, color: (isFriend || friendRequested) ? '#16a34a' : '#fff' }} />}
                <span style={{ fontSize: 14, fontWeight: 700, color: (isFriend || friendRequested) ? '#16a34a' : '#fff' }}>{isFriend ? '✓ Friends' : friendRequested ? '✓ Request Sent' : `Add ${displayName.split(' ')[0]} as Friend`}</span>
              </motion.button>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handlePing} disabled={alreadyPinged || pingLoading}
                style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: alreadyPinged ? 'default' : 'pointer', background: alreadyPinged ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg, #FF6B35, #E85A2B)', boxShadow: alreadyPinged ? 'none' : '0 6px 20px rgba(255,107,53,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {pingLoading ? <Loader2 style={{ width: 17, height: 17, color: '#fff' }} className="animate-spin" /> : <Zap style={{ width: 17, height: 17, color: alreadyPinged ? '#16a34a' : '#fff' }} fill={alreadyPinged ? '#16a34a' : 'none'} />}
                <span style={{ fontSize: 14, fontWeight: 700, color: alreadyPinged ? '#16a34a' : '#fff' }}>{alreadyPinged ? '✓ Pinged!' : `Ping ${displayName.split(' ')[0]}`}</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/lounge/private', { state: { traveler: viewingCheckin } })}
                style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1.5px solid rgba(30,136,229,0.25)', cursor: 'pointer', background: 'rgba(30,136,229,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <MessageCircle style={{ width: 17, height: 17, color: '#1E88E5' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1E88E5' }}>Message in Lounge</span>
              </motion.button>
            </motion.div>
          )}

          {/* Own profile actions */}
          {isOwnProfile && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* ── NOTIFICATION SETTINGS ── */}
              <NotificationSettings />

              {[
                { icon: <RefreshCw style={{ width: 15, height: 15, color: '#1E88E5' }} />, iconBg: 'rgba(30,136,229,0.1)', title: 'New Journey', sub: 'Check in on a different vehicle', border: 'rgba(30,136,229,0.15)', action: handleNewJourney, titleColor: '#0f172a' },
                { icon: <LogOut style={{ width: 15, height: 15, color: '#FF6B35' }} />, iconBg: 'rgba(255,107,53,0.1)', title: 'Sign Out', sub: 'Your data stays saved', border: 'rgba(255,107,53,0.15)', action: handleSignOut, titleColor: '#0f172a' },
                { icon: <Trash2 style={{ width: 15, height: 15, color: '#ef4444' }} />, iconBg: 'rgba(239,68,68,0.08)', title: 'Delete Account', sub: 'Permanently remove all data', border: 'rgba(239,68,68,0.15)', action: () => setShowDeleteConfirm(true), titleColor: '#ef4444' },
              ].map((item, i) => (
                <motion.button key={i} whileTap={{ scale: 0.97 }} onClick={item.action}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${item.border}`, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 11, flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: item.titleColor, margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{item.sub}</p>
                  </div>
                  <ChevronRight style={{ width: 15, height: 15, color: '#94a3b8' }} />
                </motion.button>
              ))}
            </motion.div>
          )}

          <div style={{ height: 6 }} />
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around', position: 'relative', zIndex: 20 }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <Gamepad2 style={{ width: 22, height: 22 }} />, label: 'Activities', active: false, action: () => navigate('/activities') },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: item.active ? '#1E88E5' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            {item.active && <motion.div layoutId="profile-nav-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#1E88E5', marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 16px 32px' }}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              style={{ width: '100%', background: '#fff', borderRadius: 24, padding: '22px 18px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Trash2 style={{ width: 20, height: 20, color: '#ef4444' }} />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 6px' }}>Delete Account?</h2>
              <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.5 }}>This will permanently delete all your data. Cannot be undone.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(226,232,240,0.8)', background: '#f8fafc', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569' }}>Cancel</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleDeleteAccount} disabled={deleteLoading}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {deleteLoading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <Trash2 style={{ width: 15, height: 15 }} />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};