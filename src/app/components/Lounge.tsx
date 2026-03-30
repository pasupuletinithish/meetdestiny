import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MessageCircle, Users, MapPin, Radio, User as UserIcon, Gamepad2, Search, Loader2 } from 'lucide-react';
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

      const { data: blockedData } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id);
      const blockedSet = new Set(blockedData?.map(b => b.blocked_id) || []);

      const { data: unreadMsgs } = await supabase
        .from('private_messages').select('from_user_id')
        .eq('to_user_id', user.id).eq('is_seen', false);

      const unreadCount = (unreadMsgs || []).filter(m => !blockedSet.has(m.from_user_id)).length;
      setUnreadPrivate(unreadCount);

      setLoading(false);
    };
    init();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#007AFF' }} className="animate-spin" />
      </div>
    );
  }


  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Premium iOS-style Header with Cool Logo Animation */}
      <div style={{ padding: '52px 20px 16px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '34px', fontWeight: 800, letterSpacing: '-0.8px', color: '#000' }}>Chats</h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8e8e93', fontWeight: 500 }}>MeetDestiny Network</p>
          </div>
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 0px 0px rgba(0, 122, 255, 0)',
                '0 0 20px 4px rgba(0, 122, 255, 0.15)',
                '0 0 0px 0px rgba(0, 122, 255, 0)'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'relative', width: 44, height: 44, borderRadius: '22px', background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.3)', opacity: 0.8 }}
            />
            <Radio size={22} color="#fff" strokeWidth={2.5} />
          </motion.div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fa', padding: '24px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Large Card: Group */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/lounge/group')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring' }}
            style={{ 
              borderRadius: '28px', 
              padding: '28px',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#fff',
              boxShadow: '0 16px 40px rgba(37, 211, 102, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {/* Background motion graphics */}
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
               style={{ position: 'absolute', top: '-30%', right: '-15%', width: '200px', height: '200px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }}
            />
            <motion.div 
               animate={{ rotate: -360 }}
               transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
               style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '160px', height: '160px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}
            />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '14px', borderRadius: '20px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                  <MessageCircle size={36} color="#fff" />
                </div>
                {groupMessageCount > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                    style={{ background: 'rgba(255,255,255,0.3)', padding: '8px 16px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, backdropFilter: 'blur(8px)' }}
                  >
                    {groupMessageCount} recent
                  </motion.div>
                )}
              </div>
              
              <h2 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px' }}>
                Vehicle Group
              </h2>
              <p style={{ margin: 0, fontSize: '16px', opacity: 0.9, fontWeight: 500 }}>
                {currentCheckin?.vehicle_id || 'Join your fellow travelers'}
              </p>
            </div>
          </motion.div>

          {/* Bottom Grid: Individual & Destination */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Individual Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/lounge/travelers')}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, type: 'spring' }}
              style={{ 
                borderRadius: '28px', 
                padding: '24px 20px',
                background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                color: '#fff',
                boxShadow: '0 16px 32px rgba(0, 122, 255, 0.25)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '200px'
              }}
            >
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '18px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                    <Users size={30} color="#fff" />
                  </div>
                  {unreadPrivate > 0 && (
                    <motion.div 
                      animate={{ scale: [1, 1.15, 1] }} 
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                      style={{ background: '#FF3B30', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 12px rgba(255,59,48,0.4)' }}
                    >
                      {unreadPrivate}
                    </motion.div>
                  )}
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>Individual</h3>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.85, lineHeight: 1.3, fontWeight: 500 }}>
                  {travelers.length} active now
                </p>
              </div>
              
              <motion.div 
                 animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0.15, 0.05] }}
                 transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                 style={{ position: 'absolute', bottom: '-30px', right: '-30px', width: '120px', height: '120px', background: '#fff', borderRadius: '50%' }}
              />
            </motion.div>

            {/* Destination Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/lounge/destination')}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
              style={{ 
                borderRadius: '28px', 
                padding: '24px 20px',
                background: 'linear-gradient(135deg, #FF9500, #FF2D55)',
                color: '#fff',
                boxShadow: '0 16px 32px rgba(255, 45, 85, 0.25)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '200px'
              }}
            >
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '18px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                    <MapPin size={30} color="#fff" />
                  </div>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>Destination</h3>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.85, lineHeight: 1.3, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {currentCheckin?.to_location || 'Explore hub'}
                </p>
              </div>
              
              <motion.div 
                 animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.2, 0.08], rotate: 180 }}
                 transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                 style={{ position: 'absolute', top: '10px', right: '-40px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}
              />
            </motion.div>

          </div>
        </div>
      </div>

      {/* Bottom AdSlot */}
      <div style={{ padding: '16px', background: '#fff' }}>
        <AdSlot />
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        background: '#f8f8f8', borderTop: '1px solid #ddd', padding: '8px 16px env(safe-area-inset-bottom)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center'
      }}>
        {[
          { icon: <Radio style={{ width: 26, height: 26 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 26, height: 26 }} />, label: 'Chats', active: true, action: () => {} },
          { icon: <Users style={{ width: 26, height: 26 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <Gamepad2 style={{ width: 26, height: 26 }} />, label: 'Activities', active: false, action: () => navigate('/activities') },
        ].map(item => (
          <motion.button key={item.label} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: item.active ? '#007AFF' : '#8e8e93', cursor: 'pointer' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};