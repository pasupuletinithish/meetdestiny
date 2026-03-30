import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Users, MapPin, Menu, X, Radio, Activity, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VehicleGroupChat, DestinationChat } from './GroupChat';
import { TravelersList } from './TravelersList';

export const Lounge: React.FC = () => {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<'individual' | 'group' | 'destination'>('individual');
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadPrivate, setUnreadPrivate] = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: blockedData } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id);
      const blockedSet = new Set(blockedData?.map(b => b.blocked_id) || []);

      const { data: unreadMsgs } = await supabase
        .from('private_messages').select('from_user_id')
        .eq('to_user_id', user.id).eq('is_seen', false);

      const unreadCount = (unreadMsgs || []).filter(m => !blockedSet.has(m.from_user_id)).length;
      setUnreadPrivate(unreadCount);
    };
    init();
  }, []);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', position: 'relative', overflow: 'hidden' }}>
      
      {/* ── HAMBURGER MENU OVERLAY ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '75%', maxWidth: 320, background: '#fff', zIndex: 100, boxShadow: '-10px 0 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '52px 24px 20px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #f1f5f9' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#f8fafc', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={18} color="#64748b" />
                </motion.button>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1E88E5', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px', opacity: 0.8 }}>Navigation</p>
                
                {[
                  { icon: <Radio size={20} />, label: 'Discovery', action: () => navigate('/discovery') },
                  { icon: <MessageCircle size={20} />, label: 'Chats', action: () => { setMenuOpen(false); } },
                  { icon: <Users size={20} />, label: 'Friends', action: () => navigate('/friends') },
                  { icon: <Activity size={20} />, label: 'Activities', action: () => navigate('/activities') },
                  { icon: <UserIcon size={20} />, label: 'Profile', action: () => navigate('/profile') },
                ].map((item, i) => (
                  <motion.button 
                    key={item.label} whileTap={{ scale: 0.97 }} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: item.label === 'Chats' ? 'rgba(30,136,229,0.08)' : '#fff', border: item.label === 'Chats' ? '1px solid rgba(30,136,229,0.2)' : '1px solid transparent', cursor: 'pointer' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: item.label === 'Chats' ? 'rgba(30,136,229,0.15)' : 'rgba(30,136,229,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E88E5', opacity: item.label === 'Chats' ? 1 : 0.8 }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1E88E5', opacity: item.label === 'Chats' ? 1 : 0.8 }}>{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ACTIVE CHAT BODY ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', paddingBottom: 80, paddingTop: 'env(safe-area-inset-top)' }}>
        {activeChat === 'individual' && <TravelersList isChild />}
        {activeChat === 'group' && <VehicleGroupChat isChild />}
        {activeChat === 'destination' && <DestinationChat isChild />}
      </div>

      {/* ── FLOATING BUTTONS (Segmented Pill) ── */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 50, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: 32, padding: 6, display: 'flex', gap: 6, boxShadow: '0 8px 32px rgba(30,136,229,0.15)', border: '1px solid rgba(30,136,229,0.15)', width: '100%', maxWidth: 420 }}>
          
          {/* Menu Button inline */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMenuOpen(true)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
              background: 'rgba(30,136,229,0.08)',
              color: '#1E88E5',
              flexShrink: 0
            }}
          >
            <Menu size={20} color="#1E88E5" />
          </motion.button>

          <div style={{ width: 1, background: 'rgba(30,136,229,0.15)', margin: '6px 2px' }} />

          <div style={{ display: 'flex', flex: 1, gap: 4 }}>
            {[
              { id: 'individual', icon: <UserIcon size={18} />, label: 'Chat' },
              { id: 'group', icon: <Users size={18} />, label: 'Group' },
              { id: 'destination', icon: <MapPin size={18} />, label: 'Dest' }
            ].map(btn => {
              const isActive = activeChat === btn.id;
              return (
                <motion.button
                  key={btn.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveChat(btn.id as any)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    flex: isActive ? 1.5 : 1,
                    padding: '10px 0',
                    borderRadius: 24, border: 'none', cursor: 'pointer',
                    background: isActive ? '#1E88E5' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(30,136,229,0.7)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative'
                  }}
                >
                  {/* Unread badge for individual mode */}
                  {btn.id === 'individual' && unreadPrivate > 0 && !isActive && (
                    <div style={{ position: 'absolute', top: -2, right: 4, background: '#fff', color: '#1E88E5', fontSize: 10, fontWeight: 800, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1E88E5' }}>
                      {unreadPrivate}
                    </div>
                  )}
                  {btn.icon}
                  {isActive && <span style={{ fontSize: 13, fontWeight: 700 }}>{btn.label}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
      
    </div>
  );
};