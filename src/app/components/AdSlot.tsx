import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Coffee } from 'lucide-react';

const ads = [
  {
    id: 1,
    title: 'Premium Stays at 30% Off',
    subtitle: 'Relax in luxury lounges worldwide. Book your next stay with MeetDestiny.',
    icon: <Map style={{ width: 24, height: 24, color: '#fff' }} />,
    bg: 'linear-gradient(135deg, #6366f1, #a855f7)',
    btn: '#4f46e5'
  },
  {
    id: 2,
    title: 'Unlimited Station Coffee',
    subtitle: 'Subscribe to Destiny+ for unlimited coffee at partner stations.',
    icon: <Coffee style={{ width: 24, height: 24, color: '#fff' }} />,
    bg: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    btn: '#ea580c'
  }
];

export const AdSlot: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ 
            background: ads[currentIndex].bg, 
            padding: '14px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            cursor: 'pointer'
          }}
        >
          {/* Ad Badge */}
          <div style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', padding: '3px 10px', borderBottomLeftRadius: 12, fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Featured
          </div>

          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {ads[currentIndex].icon}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ads[currentIndex].title}
            </h4>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
              {ads[currentIndex].subtitle}
            </p>
          </div>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ padding: '6px 14px', borderRadius: 20, background: '#fff', color: ads[currentIndex].btn, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', flexShrink: 0 }}
          >
            Explore
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
