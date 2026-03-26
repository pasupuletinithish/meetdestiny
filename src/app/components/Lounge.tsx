import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Users, MapPin, Radio, User as UserIcon, BellOff, Bell, Loader2, ChevronRight, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { AdSlot } from './AdSlot';

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
    {
      id: 'games',
      icon: <Gamepad2 style={{ width: 22, height: 22, color: '#fff' }} />,
      title: 'Multiplayer Games',
      subtitle: 'Play with co-travelers',
      meta: 'Tic-Tac-Toe Live',
      gradient: 'linear-gradient(135deg, #10b981, #047857)',
      glow: 'rgba(16,185,129,0.2)',
      badge: 0,
      action: () => navigate('/lounge/games'),
      mutable: false,
      muted: false,
    },
    {
      id: 'watch-party',
      icon: <Radio style={{ width: 22, height: 22, color: '#fff' }} />,
      title: 'Sync Watch Party',
      subtitle: 'Watch videos together',
      meta: 'Live Sync',
      gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
      glow: 'rgba(236,72,153,0.2)',
      badge: 0,
      action: () => navigate('/lounge/watch-party'),
      mutable: false,
      muted: false,
    },
  ];

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* Premium Ambient Background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.8 }}>
        <motion.div style={{ position: 'absolute', width: 400, height: 400, top: '-10%', left: '-20%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }}
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div style={{ position: 'absolute', width: 350, height: 350, bottom: '-10%', right: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }}
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div style={{ position: 'absolute', width: 250, height: 250, top: '40%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 60%)', filter: 'blur(30px)' }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      {/* ── PREMIUM HEADER ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, padding: '24px 24px 16px', background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderBottom: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #1E88E5, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(30,136,229,0.3), inset 0 2px 4px rgba(255,255,255,0.3)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)' }} />
            <MessageCircle style={{ width: 22, height: 22, color: '#fff' }} />
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 2px', background: 'linear-gradient(90deg, #1E88E5, #FF6B35, #7c3aed)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shine 5s linear infinite' }}>
              The Lounge
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
              {currentCheckin?.vehicle_id} · <span style={{ opacity: 0.7 }}>{currentCheckin?.from_location} → {currentCheckin?.to_location}</span>
            </p>
          </div>
          {/* Live dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 24, padding: '6px 12px', boxShadow: '0 2px 10px rgba(34,197,94,0.1)' }}>
            <motion.div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live</span>
          </div>
        </div>

        {/* Traveler avatar stack */}
        {travelers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, background: 'rgba(255,255,255,0.4)', padding: '8px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.6)' }}>
            <div style={{ display: 'flex' }}>
              {travelers.slice(0, 5).map((t, i) => (
                <motion.div key={t.id} 
                  whileHover={{ y: -4, scale: 1.1, zIndex: 10 }}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    marginLeft: i > 0 ? -12 : 0,
                    background: t.avatar_url ? 'transparent' : `linear-gradient(135deg, hsl(${(i * 60 + 210) % 360}, 70%, 60%), hsl(${(i * 60 + 210) % 360}, 70%, 40%))`,
                    border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: travelers.length - i, overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer'
                  }}>
                  {t.avatar_url
                    ? <img src={t.avatar_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{t.name.split(' ').map((n: string) => n[0]).join('')}</span>
                  }
                </motion.div>
              ))}
              {travelers.length > 5 && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', marginLeft: -12, background: '#f1f5f9', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>+{travelers.length - 5}</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              <strong style={{ color: '#0f172a' }}>{travelers.length}</strong> fellow traveler{travelers.length !== 1 ? 's' : ''} online
            </span>
          </motion.div>
        )}
      </div>

      <div style={{ padding: '0 16px', marginTop: '14px', position: 'relative', zIndex: 10 }}>
        <AdSlot />
      </div>

      {/* ── PREMIUM CARDS ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', scrollbarWidth: 'none', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{`
          @keyframes shine { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
          .premium-card:hover .arrow-icon { transform: translateX(4px); }
        `}</style>
        {[
          { title: 'Conversations', icon: <MessageCircle style={{ width: 16, height: 16, color: '#64748b' }} />, items: cards.slice(0, 3) },
          { title: 'Activities', icon: <Gamepad2 style={{ width: 16, height: 16, color: '#64748b' }} />, items: cards.slice(3) }
        ].map((group, groupIdx) => (
          <React.Fragment key={group.title}>
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: groupIdx * 0.2 }}
              style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, marginTop: groupIdx === 0 ? 0 : 16 }}>
              {group.icon}
              <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', margin: 0 }}>
                {group.title}
              </h2>
            </motion.div>
            
            {group.items.map((card, index) => {
              const globalIndex = groupIdx === 0 ? index : index + 3;
              return (
                <motion.div
                  key={card.id}
                  className="premium-card"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: globalIndex * 0.1, duration: 0.5, type: 'spring', damping: 20 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={card.action}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderTop: '1px solid rgba(255,255,255,1)',
                    borderLeft: '1px solid rgba(255,255,255,1)',
                    borderRadius: 24,
                    overflow: 'hidden',
                    boxShadow: `0 12px 32px -8px ${card.glow}, inset 0 2px 8px rgba(255,255,255,0.5)`,
                  }}>
                    {/* Colored subtle highlight at top */}
                    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: card.gradient, opacity: 0.6, filter: 'blur(2px)' }} />

                    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Premium Icon Container */}
                      <div style={{ position: 'relative' }}>
                        <motion.div
                          animate={{ scale: [1, 1.03, 1] }}
                          transition={{ duration: 3, repeat: Infinity, delay: globalIndex * 0.3 }}
                          style={{ width: 56, height: 56, borderRadius: 18, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px ${card.glow}, inset 0 2px 4px rgba(255,255,255,0.3)`, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />
                          <div style={{ position: 'relative', zIndex: 1 }}>{card.icon}</div>
                        </motion.div>
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                            {card.title}
                          </h3>
                          {card.badge > 0 && (
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: 'spring' }}
                              style={{ background: '#ef4444', borderRadius: 12, padding: '2px 8px', boxShadow: '0 2px 8px rgba(239,68,68,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{card.badge} New</span>
                            </motion.div>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 2px', fontWeight: 500 }}>{card.subtitle}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.meta}</p>
                      </div>

                      {/* Right side arrows & actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {card.mutable && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={e => { e.stopPropagation(); card.muteAction?.(); }}
                            style={{ width: 36, height: 36, borderRadius: 12, border: card.muted ? '1px solid rgba(148,163,184,0.3)' : '1px solid rgba(30,136,229,0.2)', cursor: 'pointer', background: card.muted ? 'rgba(241,245,249,0.8)' : 'rgba(239,246,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            {card.muted
                              ? <BellOff style={{ width: 16, height: 16, color: '#94a3b8' }} />
                              : <Bell style={{ width: 16, height: 16, color: '#1E88E5' }} />
                            }
                          </motion.button>
                        )}
                        <div className="arrow-icon" style={{ width: 32, height: 32, borderRadius: 12, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(226,232,240,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.3s ease' }}>
                          <ChevronRight style={{ width: 18, height: 18, color: '#64748b' }} />
                        </div>
                      </div>
                    </div>

                    {/* Muted indicator */}
                    <AnimatePresence>
                      {card.muted && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ background: 'rgba(241,245,249,0.8)', borderTop: '1px dashed rgba(203,213,225,0.5)', overflow: 'hidden' }}>
                          <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BellOff style={{ width: 12, height: 12, color: '#64748b' }} />
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Notifications paused for this chat</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </React.Fragment>
        ))}

        {/* Empty travelers note */}
        {travelers.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{ background: 'linear-gradient(135deg, rgba(30,136,229,0.05), rgba(30,136,229,0.02))', border: '1.5px dashed rgba(30,136,229,0.2)', borderRadius: 20, padding: '20px', textAlign: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>👀</span>
            <p style={{ fontSize: 14, color: '#475569', margin: 0, fontWeight: 600 }}>
              No other travelers yet.
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              Group & destination chats are ready when they join!
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