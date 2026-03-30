import React from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Radio, MessageCircle, Users, Gamepad2 } from 'lucide-react';
import { AdSlot } from './AdSlot';

export const ActivitiesTab: React.FC = () => {
  const navigate = useNavigate();

  const activities = [
    {
      id: 'games',
      icon: <Gamepad2 style={{ width: 24, height: 24, color: '#fff' }} />,
      title: 'Multiplayer Games',
      subtitle: 'Play with co-travelers',
      meta: 'Tic-Tac-Toe Live',
      gradient: 'linear-gradient(135deg, #10b981, #047857)',
      glow: 'rgba(16,185,129,0.2)',
      action: () => navigate('/lounge/games'),
    },
    {
      id: 'watch-party',
      icon: <Radio style={{ width: 24, height: 24, color: '#fff' }} />,
      title: 'Sync Watch Party',
      subtitle: 'Watch videos together',
      meta: 'Live Sync',
      gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
      glow: 'rgba(236,72,153,0.2)',
      action: () => navigate('/lounge/watch-party'),
    },
  ];

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>
      {/* Header */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0, padding: '44px 24px 16px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: 20 }}>
          <AdSlot />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#0f172a' }}>
          Fun & Activities
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
          Play games and watch media with co-travelers
        </p>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activities.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={card.action}
            style={{ cursor: 'pointer', position: 'relative', background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px ${card.glow}` }}>
                {card.icon}
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 4px' }}>{card.subtitle}</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.meta}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        position: 'relative', zIndex: 20, flexShrink: 0,
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        padding: '8px 0 max(12px, env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'space-around',
      }}>
        {[
          { icon: <Radio style={{ width: 24, height: 24 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 24, height: 24 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 24, height: 24 }} />, label: 'Friends', active: false, action: () => navigate('/friends') },
          { icon: <Gamepad2 style={{ width: 24, height: 24 }} />, label: 'Activities', active: true, action: () => {} },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 20px', color: item.active ? '#10b981' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 11, fontWeight: item.active ? 600 : 500 }}>{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
