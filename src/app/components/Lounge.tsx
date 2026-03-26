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

      const { count: pCount } = await supabase
        .from('private_messages').select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id).eq('is_seen', false);
      setUnreadPrivate(pCount || 0);

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

  const chats = [
    {
      id: 'individual',
      title: 'Individual Chats',
      subtitle: `${travelers.length} traveler${travelers.length !== 1 ? 's' : ''} available to chat`,
      time: 'Just now',
      unread: unreadPrivate,
      icon: <Users style={{ width: 26, height: 26, color: '#fff' }} />,
      color: '#34B7F1', 
      action: () => navigate('/lounge/travelers'),
    },
    {
      id: 'group',
      title: `${currentCheckin?.vehicle_id} Group`,
      subtitle: `${groupMessageCount > 0 ? groupMessageCount + ' messages so far' : 'Tap to start chatting'}`,
      time: '12:45 PM',
      unread: 0,
      icon: <MessageCircle style={{ width: 26, height: 26, color: '#fff' }} />,
      color: '#25D366', 
      action: () => navigate('/lounge/group'),
    },
    {
      id: 'destination',
      title: `${currentCheckin?.to_location} Visitors`,
      subtitle: `${destMessageCount > 0 ? destMessageCount + ' messages in hub' : 'Meet people heading here'}`,
      time: 'Yesterday',
      unread: 0,
      icon: <MapPin style={{ width: 26, height: 26, color: '#fff' }} />,
      color: '#128C7E', 
      action: () => navigate('/lounge/destination'),
    }
  ];

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* iOS WhatsApp Header */}
      <div style={{ padding: '24px 16px 12px', background: '#f6f6f6', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#007AFF', fontSize: 17 }}>Edit</span>
          <motion.button whileTap={{ opacity: 0.5 }} onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
             <UserIcon style={{ color: '#007AFF', width: 24, height: 24 }} />
          </motion.button>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: '0 0 12px', color: '#000', letterSpacing: '-0.5px' }}>Chats</h1>
        
        <div style={{ display: 'flex', background: '#e4e5e7', borderRadius: 10, padding: '8px 12px', alignItems: 'center', gap: 8 }}>
           <Search style={{ width: 16, height: 16, color: '#8e8e93' }} />
           <input type="text" placeholder="Search" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 17, width: '100%', color: '#000' }} />
        </div>
      </div>

      <div style={{ padding: '0 16px', background: '#fff' }}>
         <AdSlot />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {chats.map((chat, idx) => (
          <motion.div key={chat.id} whileTap={{ background: '#e5e5ea' }} onClick={chat.action} style={{ display: 'flex', padding: '0 0 0 16px', background: '#fff', cursor: 'pointer', transition: 'background 0.2s' }}>
            <div style={{ padding: '12px 0' }}>
               <div style={{ width: 56, height: 56, borderRadius: '50%', background: chat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 {chat.icon}
               </div>
            </div>
            
            <div style={{ flex: 1, marginLeft: 12, padding: '12px 16px 12px 0', borderBottom: idx < chats.length - 1 ? '1px solid #e5e5ea' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: '#000' }}>{chat.title}</span>
                  <span style={{ fontSize: 15, color: chat.unread > 0 ? '#007AFF' : '#8e8e93' }}>{chat.time}</span>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, color: '#8e8e93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>{chat.subtitle}</span>
                  {chat.unread > 0 && (
                    <div style={{ background: '#007AFF', borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{chat.unread}</span>
                    </div>
                  )}
               </div>
            </div>
          </motion.div>
        ))}
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