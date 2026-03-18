import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MessageCircle, Users, MapPin, Radio, User as UserIcon, BellOff, Bell, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

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
}

interface TravelerData {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  vehicle_id: string;
  to_location: string;
  arrival_time: string;
  vibe: string;
  avatar_url?: string;
}

export const Lounge: React.FC = () => {
  const navigate = useNavigate();
  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [travelers, setTravelers] = useState<TravelerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupMessageCount, setGroupMessageCount] = useState(0);
  const [destMessageCount, setDestMessageCount] = useState(0);
  const [unreadPrivate, setUnreadPrivate] = useState(0);
  const [mutedGroup, setMutedGroup] = useState(false);
  const [mutedDest, setMutedDest] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

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

      const { count: gCount } = await supabase
        .from('lounge_messages').select('*', { count: 'exact', head: true })
        .eq('vehicle_id', checkin.vehicle_id);
      setGroupMessageCount(gCount || 0);

      const { count: dCount } = await supabase
        .from('destination_messages').select('*', { count: 'exact', head: true })
        .eq('destination', checkin.to_location);
      setDestMessageCount(dCount || 0);

      const { count: pCount } = await supabase
        .from('private_messages').select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id).eq('is_seen', false);
      setUnreadPrivate(pCount || 0);

      const { data: mutes } = await supabase
        .from('muted_chats').select('*').eq('user_id', user.id);
      if (mutes) {
        setMutedGroup(mutes.some(m => m.chat_type === 'group' && m.chat_id === checkin.vehicle_id));
        setMutedDest(mutes.some(m => m.chat_type === 'destination' && m.chat_id === checkin.to_location));
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  const toggleMute = async (type: 'group' | 'destination') => {
    if (!currentCheckin) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const chatId = type === 'group' ? currentCheckin.vehicle_id : currentCheckin.to_location;
    const isMuted = type === 'group' ? mutedGroup : mutedDest;
    if (isMuted) {
      await supabase.from('muted_chats').delete()
        .eq('user_id', user.id).eq('chat_type', type).eq('chat_id', chatId);
      type === 'group' ? setMutedGroup(false) : setMutedDest(false);
      toast.success('Unmuted');
    } else {
      await supabase.from('muted_chats').insert({ user_id: user.id, chat_type: type, chat_id: chatId });
      type === 'group' ? setMutedGroup(true) : setMutedDest(true);
      toast.success('Muted');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      id: 'individual',
      icon: <MessageCircle style={{ width: 22, height: 22, color: '#fff' }} />,
      title: 'Individual Chats',
      subtitle: `${travelers.length} traveler${travelers.length !== 1 ? 's' : ''} available`,
      meta: unreadPrivate > 0 ? `${unreadPrivate} unread` : 'Private 1-on-1',
      gradient: 'linear-gradient(135deg, #1E88E5, #1565C0)',
      glow: 'rgba(30,136,229,0.2)',
      badge: unreadPrivate,
      action: () => navigate('/lounge/travelers'),
      mutable: false,
      muted: false,
    },
    {
      id: 'group',
      icon: <Users style={{ width: 22, height: 22, color: '#fff' }} />,
      title: `${currentCheckin?.vehicle_id}`,
      subtitle: `${travelers.length + 1} members`,
      meta: `${groupMessageCount} messages`,
      gradient: 'linear-gradient(135deg, #FF6B35, #E85A2B)',
      glow: 'rgba(255,107,53,0.2)',
      badge: 0,
      action: () => navigate('/lounge/group'),
      mutable: true,
      muted: mutedGroup,
      muteAction: () => toggleMute('group'),
    },
    {
      id: 'destination',
      icon: <MapPin style={{ width: 22, height: 22, color: '#fff' }} />,
      title: `${currentCheckin?.to_location}`,
      subtitle: 'Destination chat',
      meta: `${destMessageCount} messages`,
      gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
      glow: 'rgba(124,58,237,0.2)',
      badge: 0,
      action: () => navigate('/lounge/destination'),
      mutable: true,
      muted: mutedDest,
      muteAction: () => toggleMute('destination'),
    },
  ];

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 300, height: 300, top: '-10%', left: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 260, height: 260, bottom: '-8%', right: '-12%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* ── HEADER ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, padding: '16px 20px 12px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(135deg, #1E88E5, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(30,136,229,0.3)', flexShrink: 0 }}>
            <MessageCircle style={{ width: 18, height: 18, color: '#fff' }} />
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              The Lounge
            </h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentCheckin?.vehicle_id} · {currentCheckin?.from_location} → {currentCheckin?.to_location}
            </p>
          </div>
          {/* Live dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '4px 10px' }}>
            <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Live</span>
          </div>
        </div>

        {/* Traveler avatar stack */}
        {travelers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex' }}>
              {travelers.slice(0, 5).map((t, i) => (
                <div key={t.id} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  marginLeft: i > 0 ? -8 : 0,
                  background: t.avatar_url ? 'transparent' : `hsl(${(i * 60 + 210) % 360}, 70%, 50%)`,
                  border: '2px solid white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: travelers.length - i, overflow: 'hidden',
                }}>
                  {t.avatar_url
                    ? <img src={t.avatar_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{t.name.split(' ').map((n: string) => n[0]).join('')}</span>
                  }
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {travelers.length} fellow traveler{travelers.length !== 1 ? 's' : ''} online
            </span>
          </div>
        )}
      </div>

      {/* ── CARDS ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', scrollbarWidth: 'none', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            whileTap={{ scale: 0.98 }}
            onClick={card.action}
            style={{ cursor: 'pointer' }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: `0 4px 20px ${card.glow}`,
            }}>
              {/* Colored top strip */}
              <motion.div
                style={{ height: 3, background: card.gradient }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
              />

              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Icon */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  style={{ width: 48, height: 48, borderRadius: 15, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${card.glow}`, flexShrink: 0 }}>
                  {card.icon}
                </motion.div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.title}
                    </p>
                    {card.badge > 0 && (
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring' }}
                        style={{ background: '#FF6B35', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{card.badge}</span>
                      </motion.div>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{card.subtitle}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{card.meta}</p>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Mute button */}
                  {card.mutable && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={e => { e.stopPropagation(); card.muteAction?.(); }}
                      style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: card.muted ? 'rgba(148,163,184,0.12)' : 'rgba(30,136,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {card.muted
                        ? <BellOff style={{ width: 14, height: 14, color: '#94a3b8' }} />
                        : <Bell style={{ width: 14, height: 14, color: '#1E88E5' }} />
                      }
                    </motion.button>
                  )}
                  {/* Arrow */}
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.2 }}
                    style={{ width: 28, height: 28, borderRadius: 8, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${card.glow}` }}>
                    <ChevronRight style={{ width: 14, height: 14, color: '#fff' }} />
                  </motion.div>
                </div>
              </div>

              {/* Muted indicator */}
              {card.muted && (
                <div style={{ padding: '6px 16px', background: 'rgba(148,163,184,0.06)', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BellOff style={{ width: 11, height: 11, color: '#94a3b8' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Notifications muted</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Empty travelers note */}
        {travelers.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ background: 'rgba(30,136,229,0.04)', border: '1.5px dashed rgba(30,136,229,0.15)', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              👀 No other travelers yet — group & destination chats are ready!
            </p>
          </motion.div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: 'relative', zIndex: 20, flexShrink: 0,
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(30,136,229,0.08)',
        padding: '8px 0 max(12px, env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'space-around',
      }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: true, action: () => {} },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <UserIcon style={{ width: 22, height: 22 }} />, label: 'Profile', active: false, action: () => navigate('/profile') },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: item.active ? '#1E88E5' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            {item.active && <motion.div layoutId="lounge-nav-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#1E88E5', marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>
    </div>
  );
};