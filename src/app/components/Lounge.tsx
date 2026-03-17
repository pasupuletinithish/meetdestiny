import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Users, MapPin, Radio, User as UserIcon, BellOff, Bell, Loader2 } from 'lucide-react';
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
  const [activeCard, setActiveCard] = useState<string | null>(null);

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

      // Fetch travelers on same vehicle
      const { data: tvlrs } = await supabase
        .from('checkins').select('*')
        .eq('vehicle_id', checkin.vehicle_id)
        .eq('is_active', true)
        .neq('user_id', user.id);
      setTravelers(tvlrs || []);

      // Group message count
      const { count: gCount } = await supabase
        .from('lounge_messages').select('*', { count: 'exact', head: true })
        .eq('vehicle_id', checkin.vehicle_id);
      setGroupMessageCount(gCount || 0);

      // Destination message count
      const { count: dCount } = await supabase
        .from('destination_messages').select('*', { count: 'exact', head: true })
        .eq('destination', checkin.to_location);
      setDestMessageCount(dCount || 0);

      // Unread private messages
      const { count: pCount } = await supabase
        .from('private_messages').select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id).eq('is_seen', false);
      setUnreadPrivate(pCount || 0);

      // Check muted status
      const { data: mutes } = await supabase
        .from('muted_chats').select('*')
        .eq('user_id', user.id);
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
      toast.success(`${type === 'group' ? 'Group' : 'Destination'} chat unmuted`);
    } else {
      await supabase.from('muted_chats').insert({ user_id: user.id, chat_type: type, chat_id: chatId });
      type === 'group' ? setMutedGroup(true) : setMutedDest(true);
      toast.success(`${type === 'group' ? 'Group' : 'Destination'} chat muted`);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 32, height: 32, color: '#1E88E5', margin: '0 auto 12px' }} className="animate-spin" />
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading lounge...</p>
        </motion.div>
      </div>
    );
  }

  const cards = [
    {
      id: 'individual',
      icon: <MessageCircle style={{ width: 28, height: 28 }} />,
      title: 'Individual Chats',
      subtitle: `${travelers.length} travelers available`,
      description: 'Start a private 1-on-1 conversation with anyone on your vehicle',
      gradient: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
      glow: 'rgba(30,136,229,0.25)',
      badge: unreadPrivate > 0 ? unreadPrivate : null,
      badgeColor: '#FF6B35',
      action: () => navigate('/lounge/travelers'),
      mutable: false,
    },
    {
      id: 'group',
      icon: <Users style={{ width: 28, height: 28 }} />,
      title: `${currentCheckin?.vehicle_id} Group`,
      subtitle: `${travelers.length + 1} members • ${groupMessageCount} messages`,
      description: 'Chat with everyone on your vehicle in real-time',
      gradient: 'linear-gradient(135deg, #FF6B35 0%, #E85A2B 100%)',
      glow: 'rgba(255,107,53,0.25)',
      badge: null,
      badgeColor: '#22c55e',
      action: () => navigate('/lounge/group'),
      mutable: true,
      muted: mutedGroup,
      muteAction: () => toggleMute('group'),
    },
    {
      id: 'destination',
      icon: <MapPin style={{ width: 28, height: 28 }} />,
      title: `${currentCheckin?.to_location} Chat`,
      subtitle: `Everyone on this route • ${destMessageCount} messages`,
      description: 'Connect with all travelers heading to your destination',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      glow: 'rgba(124,58,237,0.25)',
      badge: null,
      badgeColor: '#22c55e',
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
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 300, height: 300, top: '-10%', left: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 260, height: 260, bottom: '-8%', right: '-12%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 200, height: 200, top: '40%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 9, repeat: Infinity, delay: 2 }} />
      </div>

      {/* ── HEADER ── */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, padding: '20px 20px 16px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}
            style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1E88E5, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(30,136,229,0.3)', flexShrink: 0 }}>
            <MessageCircle style={{ width: 20, height: 20, color: '#fff' }} />
          </motion.div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
              The Lounge
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              {currentCheckin?.vehicle_id} • {currentCheckin?.from_location} → {currentCheckin?.to_location}
            </p>
          </div>
        </div>

        {/* Traveler avatars row */}
        {travelers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <div style={{ display: 'flex' }}>
              {travelers.slice(0, 5).map((t, i) => (
                <div key={t.id} style={{
                  width: 28, height: 28, borderRadius: '50%', marginLeft: i > 0 ? -8 : 0,
                  background: `hsl(${(i * 60 + 210) % 360}, 70%, 50%)`,
                  border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: travelers.length - i,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    {t.name.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>
              ))}
              {travelers.length > 5 && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', marginLeft: -8, background: 'rgba(30,136,229,0.15)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#1E88E5' }}>+{travelers.length - 5}</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>{travelers.length} fellow traveler{travelers.length !== 1 ? 's' : ''} online</span>
          </div>
        )}
      </div>

      {/* ── CARDS ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', scrollbarWidth: 'none', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {cards.map((card, index) => (
          <motion.div key={card.id}
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            onTapStart={() => setActiveCard(card.id)}
            onTap={() => { setActiveCard(null); card.action(); }}
            onTapCancel={() => setActiveCard(null)}
            style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', cursor: 'pointer' }}>

            {/* Card background */}
            <motion.div
              animate={{ scale: activeCard === card.id ? 0.98 : 1 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(255,255,255,0.9)',
                borderRadius: 20, overflow: 'hidden',
                boxShadow: `0 8px 32px ${card.glow}`,
              }}>

              {/* Gradient top strip */}
              <div style={{ height: 4, background: card.gradient }} />

              <div style={{ padding: '16px 18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Icon circle */}
                    <motion.div
                      animate={{ rotate: activeCard === card.id ? [0, -5, 5, 0] : 0 }}
                      style={{ width: 52, height: 52, borderRadius: 16, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: `0 6px 20px ${card.glow}`, flexShrink: 0 }}>
                      {card.icon}
                    </motion.div>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', lineHeight: 1.2 }}>{card.title}</h2>
                      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{card.subtitle}</p>
                    </div>
                  </div>

                  {/* Right side: badge + mute */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {card.badge !== null && card.badge > 0 && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: card.badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${card.badgeColor}60` }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{card.badge}</span>
                      </motion.div>
                    )}
                    {card.mutable && (
                      <motion.button whileTap={{ scale: 0.85 }}
                        onClick={e => { e.stopPropagation(); card.muteAction?.(); }}
                        style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: card.muted ? 'rgba(148,163,184,0.15)' : 'rgba(30,136,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {card.muted
                          ? <BellOff style={{ width: 14, height: 14, color: '#94a3b8' }} />
                          : <Bell style={{ width: 14, height: 14, color: '#1E88E5' }} />
                        }
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 }}>{card.description}</p>

                {/* Enter button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <motion.div
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10, background: card.gradient, boxShadow: `0 4px 12px ${card.glow}` }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {card.id === 'individual' ? 'View Travelers' : 'Enter Chat'}
                    </span>
                    <span style={{ fontSize: 16, color: '#fff' }}>→</span>
                  </motion.div>

                  {card.muted && (
                    <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BellOff style={{ width: 12, height: 12 }} /> Muted
                    </span>
                  )}
                </div>
              </div>

              {/* Shimmer effect on tap */}
              <AnimatePresence>
                {activeCard === card.id && (
                  <motion.div initial={{ opacity: 0, x: '-100%' }} animate={{ opacity: 0.15, x: '100%' }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, white, transparent)', pointerEvents: 'none' }} />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ))}

        {/* Travelers count info card */}
        {travelers.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ background: 'rgba(30,136,229,0.05)', border: '1.5px dashed rgba(30,136,229,0.2)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              👀 No other travelers on this vehicle yet. Individual chats will appear when someone joins!
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
          { icon: <UserIcon style={{ width: 22, height: 22 }} />, label: 'Profile', active: false, action: () => navigate('/profile') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
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