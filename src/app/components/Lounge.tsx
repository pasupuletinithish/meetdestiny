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
      
      {/* ── HEADER ── */}
      <div style={{ padding: '0px 20px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 100, paddingTop: 40, flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.8px', color: '#000' }}>Chats</h1>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8e8e93', fontWeight: 500 }}>MeetDestiny Network</p>
        </div>
        
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setMenuOpen(true)}
          style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f5f9', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
        >
          <Menu size={20} color="#0f172a" />
        </motion.button>
      </div>

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
                <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Navigation</p>
                
                {[
                  { icon: <Radio size={20} />, label: 'Discovery', color: '#1E88E5', action: () => navigate('/discovery') },
                  { icon: <MessageCircle size={20} />, label: 'Chats', color: '#10b981', action: () => { setMenuOpen(false); } },
                  { icon: <Users size={20} />, label: 'Friends', color: '#f59e0b', action: () => navigate('/friends') },
                  { icon: <Activity size={20} />, label: 'Activities', color: '#8b5cf6', action: () => navigate('/activities') },
                  { icon: <UserIcon size={20} />, label: 'Profile', color: '#64748b', action: () => navigate('/profile') },
                ].map((item, i) => (
                  <motion.button 
                    key={item.label} whileTap={{ scale: 0.97 }} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: item.label === 'Chats' ? `${item.color}15` : '#fff', border: item.label === 'Chats' ? `1px solid ${item.color}30` : '1px solid transparent', cursor: 'pointer' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: item.label === 'Chats' ? item.color : '#334155' }}>{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ACTIVE CHAT BODY ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', paddingBottom: 80 }}>
        {activeChat === 'individual' && <TravelersList isChild />}
        {activeChat === 'group' && <VehicleGroupChat isChild />}
        {activeChat === 'destination' && <DestinationChat isChild />}
      </div>

      {/* ── FLOATING BUTTONS (Segmented Pill) ── */}
      <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20, zIndex: 50, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: 30, padding: 6, display: 'flex', gap: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.05)' }}>
          {[
            { id: 'individual', icon: <UserIcon size={18} />, label: 'Chat', color: '#1E88E5' },
            { id: 'group', icon: <Users size={18} />, label: 'Group', color: '#25D366' },
            { id: 'destination', icon: <MapPin size={18} />, label: 'Dest', color: '#FF9500' }
          ].map(btn => {
            const isActive = activeChat === btn.id;
            return (
              <motion.button
                key={btn.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveChat(btn.id as any)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: isActive ? '10px 20px' : '10px 16px',
                  borderRadius: 24, border: 'none', cursor: 'pointer',
                  background: isActive ? btn.color : 'transparent',
                  color: isActive ? '#fff' : '#64748b',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
              >
                {/* Unread badge for individual mode */}
                {btn.id === 'individual' && unreadPrivate > 0 && !isActive && (
                  <div style={{ position: 'absolute', top: -4, right: -4, background: '#FF3B30', color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                    {unreadPrivate}
                  </div>
                )}
                {btn.icon}
                {isActive && <span style={{ fontSize: 14, fontWeight: 700 }}>{btn.label}</span>}
              </motion.button>
            );
          })}
        </div>
      </div>
      
    </div>
  );
};