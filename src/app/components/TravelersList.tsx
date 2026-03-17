import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MessageCircle, Loader2, Radio, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

const vibeColors: Record<string, string> = {
  ready: '#22c55e', logistics: '#eab308', lurking: '#ef4444',
};
const vibeLabels: Record<string, string> = {
  ready: 'Open to chat', logistics: 'Logistics only', lurking: 'Just lurking',
};

export const TravelersList: React.FC = () => {
  const navigate = useNavigate();
  const [travelers, setTravelers] = useState<TravelerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: checkin } = await supabase
        .from('checkins').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!checkin) { navigate('/check-in'); return; }

      const { data: tvlrs } = await supabase
        .from('checkins').select('*')
        .eq('vehicle_id', checkin.vehicle_id)
        .eq('is_active', true)
        .neq('user_id', user.id);

      setTravelers(tvlrs || []);

      // Get unread counts per traveler
      if (tvlrs && tvlrs.length > 0) {
        const counts: Record<string, number> = {};
        for (const t of tvlrs) {
          const { count } = await supabase
            .from('private_messages').select('*', { count: 'exact', head: true })
            .eq('from_user_id', t.user_id).eq('to_user_id', user.id).eq('is_seen', false);
          if (count && count > 0) counts[t.user_id] = count;
        }
        setUnreadCounts(counts);
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%',
    }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#1E88E5' }} />
          </motion.button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #1E88E5, #1565C0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Individual Chats
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{travelers.length} travelers available</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'none' }}>
        {travelers.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(30,136,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <UserIcon style={{ width: 24, height: 24, color: '#1E88E5' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>No travelers yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Individual chats will appear when fellow travelers check in on your vehicle.</p>
          </div>
        ) : (
          <AnimatePresence>
            {travelers.map((traveler, index) => {
              const initials = traveler.name.split(' ').map((n: string) => n[0]).join('');
              const vibe = traveler.vibe || 'ready';
              const unread = unreadCounts[traveler.user_id] || 0;

              return (
                <motion.div key={traveler.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate('/lounge/private', { state: { traveler } })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', marginBottom: 10,
                    background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)',
                    borderRadius: 16, cursor: 'pointer', backdropFilter: 'blur(12px)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  }}>

                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1E88E5, #1565C0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${vibeColors[vibe]}`,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{initials}</span>
                    </div>
                    <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                      style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: vibeColors[vibe], border: '2px solid white' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>{traveler.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{traveler.profession}</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                      <span style={{ fontSize: 11, color: vibeColors[vibe], fontWeight: 500 }}>{vibeLabels[vibe]}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {unread > 0 ? (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{unread}</span>
                      </div>
                    ) : (
                      <MessageCircle style={{ width: 16, height: 16, color: '#94a3b8' }} />
                    )}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{traveler.to_location}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: true, action: () => navigate('/lounge') },
          { icon: <UserIcon style={{ width: 22, height: 22 }} />, label: 'Profile', action: () => navigate('/profile') },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: (item as any).active ? '#1E88E5' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: (item as any).active ? 700 : 400 }}>{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};