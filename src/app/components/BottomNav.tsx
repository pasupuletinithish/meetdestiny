import React from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Radio, MessageCircle, Users, Gamepad2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'discover' | 'chats' | 'friends' | 'activities' | string;
  friendsBadge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, friendsBadge }) => {
  const navigate = useNavigate();

  const navItems = [
    { icon: Radio, label: 'Discover', id: 'discover', action: () => navigate('/discovery') },
    { icon: MessageCircle, label: 'Chats', id: 'chats', action: () => navigate('/lounge') },
    { icon: Users, label: 'Friends', id: 'friends', action: () => navigate('/friends'), badge: friendsBadge },
    { icon: Gamepad2, label: 'Activities', id: 'activities', action: () => navigate('/activities') },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 40px)',
      maxWidth: '420px',
      background: '#fff',
      borderRadius: '100px', // Perfect pill shape
      padding: '6px 8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      zIndex: 100
    }}>
      {navItems.map(item => {
        const isActive = item.id === activeTab;
        return (
          <motion.button 
            key={item.id} 
            onClick={item.action}
            whileTap={{ scale: 0.92 }}
            style={{ 
              position: 'relative',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '4px', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: '100px',
              flex: 1,
              color: isActive ? '#007AFF' : '#555'
            }}
          >
            {isActive && (
              <motion.div
                layoutId="active-nav-pill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#EBF5FF',
                  borderRadius: '100px',
                  zIndex: -1
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              />
            )}
            <div style={{ position: 'relative' }}>
              <item.icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2} 
                color={isActive ? '#007AFF' : '#555'} 
                style={isActive ? { fill: '#EBF5FF' } : {}}
              />
              {item.badge && item.badge > 0 ? (
                <div style={{ position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 10, padding: '0 4px', background: '#FF3B30', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{item.badge > 99 ? '99+' : item.badge}</span>
                </div>
              ) : null}
            </div>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500, letterSpacing: '-0.2px' }}>
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
