import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, MessageCircle, UserPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';
interface MutualMatchModalProps {
  open: boolean;
  onClose: () => void;
  matchedUser: {
    id?: string;
    user_id?: string;
    name: string;
    profession: string;
    vehicle_id?: string;
  };
}

export const MutualMatchModal: React.FC<MutualMatchModalProps> = ({
  open, onClose, matchedUser,
}) => {
  const navigate = useNavigate();
  const [friendRequested, setFriendRequested] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  const handleStartChat = () => {
    onClose();
    navigate('/lounge/private', { state: { traveler: matchedUser } });
  };

  const handleAddFriend = async () => {
    setFriendLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's checkin for names
      const { data: myCheckin } = await supabase
        .from('checkins').select('name, profession, vehicle_id')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!myCheckin) { toast.error('Check-in not found'); return; }

      const targetUserId = matchedUser.user_id || matchedUser.id;

      // Check if already friends or request exists
      const { data: existing } = await supabase
        .from('friends').select('id, status')
        .or(`and(requester_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') toast.info('Already friends!');
        else toast.info('Friend request already sent!');
        setFriendRequested(true);
        return;
      }

      const { error } = await supabase.from('friends').insert({
        requester_id: user.id,
        receiver_id: targetUserId,
        requester_name: myCheckin.name,
        receiver_name: matchedUser.name,
        requester_profession: myCheckin.profession,
        receiver_profession: matchedUser.profession,
        connected_on_vehicle: myCheckin.vehicle_id || matchedUser.vehicle_id || '',
        status: 'pending',
      });

      if (error) throw error;
      setFriendRequested(true);
      toast.success(`Friend request sent to ${matchedUser.name}! 🎉`);
      notify.friendRequest(targetUserId as string, myCheckin.name);
    } catch {
      toast.error('Failed to send friend request');
    } finally {
      setFriendLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', zIndex: 200, padding: '0 16px 32px',
            fontFamily: 'system-ui, sans-serif',
          }}
          onClick={onClose}>

          <motion.div
            initial={{ y: 120, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
              borderRadius: 28, overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(30,136,229,0.4)',
            }}>

            {/* Sparkle particles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {[...Array(16)].map((_, i) => (
                <motion.div key={i}
                  style={{
                    position: 'absolute', width: 3, height: 3, borderRadius: '50%',
                    background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#fff' : '#FF6B35',
                    left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                  }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }} />
              ))}
            </div>

            <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px 24px', textAlign: 'center' }}>

              {/* Burst icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                style={{ marginBottom: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,215,0,0.2)', border: '2px solid rgba(255,215,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Sparkles style={{ width: 32, height: 32, color: '#FFD700' }} />
                  </motion.div>
                </div>
              </motion.div>

              {/* Title */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                  Shared Destiny Match!
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '0 0 20px' }}>
                  You and <strong style={{ color: '#fff' }}>{matchedUser.name}</strong> both pinged each other!
                </p>
              </motion.div>

              {/* Matched user card */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 18, padding: '16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                      {matchedUser.name.split(' ').map((n: string) => n[0]).join('')}
                    </span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{matchedUser.name}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{matchedUser.profession}</p>
                  </div>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,215,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16 }}>✨</span>
                  </motion.div>
                </div>
              </motion.div>

              {/* Action buttons */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Add Friend */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddFriend}
                  disabled={friendRequested || friendLoading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 14 , cursor: friendRequested ? 'default' : 'pointer',
                    background: friendRequested ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.15)',
                    border: `1.5px solid ${friendRequested ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}>
                  {friendLoading
                    ? <Loader2 style={{ width: 17, height: 17, color: '#fff' }} className="animate-spin" />
                    : friendRequested
                      ? <Check style={{ width: 17, height: 17, color: '#4ade80' }} />
                      : <UserPlus style={{ width: 17, height: 17, color: '#fff' }} />
                  }
                  <span style={{ fontSize: 14, fontWeight: 700, color: friendRequested ? '#4ade80' : '#fff' }}>
                    {friendRequested ? 'Friend Request Sent!' : 'Add as Friend'}
                  </span>
                </motion.button>

                {/* Start Chat */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleStartChat}
                  style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FF6B35, #E85A2B)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(255,107,53,0.4)' }}>
                  <MessageCircle style={{ width: 17, height: 17, color: '#fff' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Start Private Chat</span>
                </motion.button>

                {/* Dismiss */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
                  style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Maybe later</span>
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};