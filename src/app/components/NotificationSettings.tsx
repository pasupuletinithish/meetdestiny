import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed,
} from '../../lib/notifications';

export const NotificationSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!isPushSupported()) {
        setSupported(false);
        setLoading(false);
        return;
      }
      const sub = await isSubscribed();
      setEnabled(sub);
      setLoading(false);
    };
    check();
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    if (enabled) {
      await unsubscribeFromPush();
      setEnabled(false);
      toast.success('Push notifications disabled');
    } else {
      const result = await subscribeToPush();
      if (result.success) {
        setEnabled(true);
        toast.success('Push notifications enabled! 🔔');
      } else {
        toast.error(`Failed to enable: ${result.error || 'Please allow notifications in your browser settings.'}`);
      }
    }
    setLoading(false);
  };

  if (!supported) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)',
        borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BellOff style={{ width: 16, height: 16, color: '#94a3b8' }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>Push Notifications</p>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Not supported on this browser</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={!loading ? handleToggle : undefined}
      style={{
        background: enabled ? 'rgba(30,136,229,0.06)' : 'rgba(255,255,255,0.8)',
        border: `1.5px solid ${enabled ? 'rgba(30,136,229,0.2)' : 'rgba(255,255,255,0.95)'}`,
        borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        transition: 'all 0.2s', fontFamily: 'system-ui, sans-serif',
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: enabled ? 'rgba(30,136,229,0.12)' : 'rgba(148,163,184,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {loading
          ? <Loader2 style={{ width: 16, height: 16, color: '#1E88E5' }} className="animate-spin" />
          : enabled
            ? <Bell style={{ width: 16, height: 16, color: '#1E88E5' }} />
            : <BellOff style={{ width: 16, height: 16, color: '#94a3b8' }} />
        }
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>Push Notifications</p>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
          {enabled ? 'Pings, messages & SOS alerts' : 'Tap to enable notifications'}
        </p>
      </div>
      {/* Toggle pill */}
      <div style={{
        width: 44, height: 24, borderRadius: 12, padding: 2,
        background: enabled ? '#1E88E5' : 'rgba(148,163,184,0.3)',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      }}>
        <motion.div
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
        />
      </div>
    </motion.div>
  );
};