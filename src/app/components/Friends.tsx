import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Check, X, MessageCircle, Radio,
  User as UserIcon, Loader2, UserPlus, Clock, Heart, Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';

interface Friend {
  id: string;
  requester_id: string;
  receiver_id: string;
  requester_name: string;
  receiver_name: string;
  requester_profession: string;
  receiver_profession: string;
  connected_on_vehicle: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export const Friends: React.FC = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingReceived, setPendingReceived] = useState<Friend[]>([]);
  const [pendingSent, setPendingSent] = useState<Friend[]>([]);
  const [accepted, setAccepted] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const fetchFriends = async (userId: string) => {
    const { data } = await supabase
      .from('friends').select('*')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data) {
      setPendingReceived(data.filter(f => f.status === 'pending' && f.receiver_id === userId));
      setPendingSent(data.filter(f => f.status === 'pending' && f.requester_id === userId));
      setAccepted(data.filter(f => f.status === 'accepted'));
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('is_banned').eq('user_id', user.id).maybeSingle();
      if (profile?.is_banned) {
        toast.error('Your account is banned.');
        navigate('/');
        return;
      }

      setCurrentUserId(user.id);
      await fetchFriends(user.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel('friends-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' },
        () => fetchFriends(currentUserId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const handleAccept = async (friend: Friend) => {
    setActionLoading(friend.id);
    const { error } = await supabase
      .from('friends').update({ status: 'accepted' }).eq('id', friend.id);
    if (error) toast.error('Failed to accept');
    else toast.success(`You and ${friend.requester_name} are now friends! 🎉`);
    notify.friendAccepted(friend.requester_id, friend.receiver_name);
    setActionLoading(null);
  };

  const handleReject = async (friend: Friend) => {
    setActionLoading(friend.id);
    const { error } = await supabase
      .from('friends').update({ status: 'rejected' }).eq('id', friend.id);
    if (error) toast.error('Failed to reject');
    else toast.success('Request declined');
    setActionLoading(null);
  };

  const handleRemoveFriend = async (friend: Friend) => {
    setActionLoading(friend.id);
    const { error } = await supabase.from('friends').delete().eq('id', friend.id);
    if (error) toast.error('Failed to remove');
    else toast.success('Friend removed');
    setActionLoading(null);
  };

  const getFriendName = (friend: Friend) =>
    friend.requester_id === currentUserId ? friend.receiver_name : friend.requester_name;

  const getFriendProfession = (friend: Friend) =>
    friend.requester_id === currentUserId ? friend.receiver_profession : friend.requester_profession;

  const getFriendUserId = (friend: Friend) =>
    friend.requester_id === currentUserId ? friend.receiver_id : friend.requester_id;

  const pendingCount = pendingReceived.length;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 280, height: 280, top: '-8%', left: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 240, height: 240, bottom: '-6%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, padding: '20px 20px 0', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(30,136,229,0.3)', flexShrink: 0 }}>
            <Users style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
              Friends
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{accepted.length} connection{accepted.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
              style={{ marginLeft: 'auto', background: '#FF6B35', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock style={{ width: 12, height: 12, color: '#fff' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{pendingCount} pending</span>
            </motion.div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {[
            { id: 'friends', label: 'Friends', count: accepted.length },
            { id: 'requests', label: 'Requests', count: pendingReceived.length + pendingSent.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2.5px solid ${activeTab === tab.id ? '#1E88E5' : 'transparent'}`,
                color: activeTab === tab.id ? '#1E88E5' : '#94a3b8',
                fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ background: activeTab === tab.id ? '#1E88E5' : '#94a3b8', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', scrollbarWidth: 'none', position: 'relative', zIndex: 10 }}>

        <AnimatePresence mode="wait">

          {/* FRIENDS TAB */}
          {activeTab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
              {accepted.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 32px' }}>
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(30,136,229,0.08)', border: '1.5px solid rgba(30,136,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Heart style={{ width: 26, height: 26, color: '#1E88E5' }} />
                  </motion.div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>No friends yet</h3>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
                    Ping travelers on your journey. When they ping back, you can add each other as friends!
                  </p>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/discovery')}
                    style={{ padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #1E88E5, #1565C0)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(30,136,229,0.3)' }}>
                    Discover Travelers
                  </motion.button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {accepted.map((friend, index) => {
                    const name = getFriendName(friend);
                    const profession = getFriendProfession(friend);
                    const friendUserId = getFriendUserId(friend);
                    const initials = name.split(' ').map((n: string) => n[0]).join('');
                    const colors = ['#1E88E5', '#FF6B35', '#7c3aed', '#16a34a', '#e11d48'];
                    const color = colors[index % colors.length];

                    return (
                      <motion.div key={friend.id}
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Avatar */}
                          <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${color}40` }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{initials}</span>
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{name}</p>
                            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px' }}>{profession}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>Met on {friend.connected_on_vehicle}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                            {/* Message */}
                            <motion.button whileTap={{ scale: 0.9 }}
                              onClick={() => navigate('/lounge/private', { state: { traveler: { user_id: friendUserId, name, profession } } })}
                              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.1)', border: '1px solid rgba(30,136,229,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MessageCircle style={{ width: 15, height: 15, color: '#1E88E5' }} />
                            </motion.button>
                            {/* Remove */}
                            <motion.button whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemoveFriend(friend)}
                              disabled={actionLoading === friend.id}
                              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {actionLoading === friend.id
                                ? <Loader2 style={{ width: 13, height: 13, color: '#ef4444' }} className="animate-spin" />
                                : <X style={{ width: 14, height: 14, color: '#ef4444' }} />
                              }
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Received requests */}
              {pendingReceived.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px 2px' }}>Received</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pendingReceived.map((friend, index) => {
                      const initials = friend.requester_name.split(' ').map((n: string) => n[0]).join('');
                      return (
                        <motion.div key={friend.id}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(30,136,229,0.15)', borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)', boxShadow: '0 2px 10px rgba(30,136,229,0.08)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{initials}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{friend.requester_name}</p>
                              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 3px' }}>{friend.requester_profession}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <UserPlus style={{ width: 11, height: 11, color: '#1E88E5' }} />
                                <span style={{ fontSize: 10, color: '#1E88E5', fontWeight: 600 }}>Wants to connect</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAccept(friend)}
                              disabled={actionLoading === friend.id}
                              style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(30,136,229,0.25)' }}>
                              {actionLoading === friend.id
                                ? <Loader2 style={{ width: 14, height: 14, color: '#fff' }} className="animate-spin" />
                                : <Check style={{ width: 14, height: 14, color: '#fff' }} />
                              }
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Accept</span>
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleReject(friend)}
                              disabled={actionLoading === friend.id}
                              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.2)', cursor: 'pointer', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <X style={{ width: 14, height: 14, color: '#ef4444' }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Decline</span>
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sent requests */}
              {pendingSent.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px 2px' }}>Sent</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pendingSent.map((friend, index) => {
                      const initials = friend.receiver_name.split(' ').map((n: string) => n[0]).join('');
                      return (
                        <motion.div key={friend.id}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B35, #E85A2B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{initials}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{friend.receiver_name}</p>
                              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{friend.receiver_profession}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.15)', borderRadius: 20, padding: '4px 10px' }}>
                              <Clock style={{ width: 11, height: 11, color: '#FF6B35' }} />
                              <span style={{ fontSize: 10, color: '#FF6B35', fontWeight: 600 }}>Pending</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {pendingReceived.length === 0 && pendingSent.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 32px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(30,136,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <UserPlus style={{ width: 24, height: 24, color: '#1E88E5' }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>No pending requests</p>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Friend requests from mutual pings will appear here.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around', position: 'relative', zIndex: 20 }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', active: false, action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', active: false, action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', active: true, badge: pendingCount, action: () => {} },
          { icon: <Gamepad2 style={{ width: 22, height: 22 }} />, label: 'Activities', active: false, action: () => navigate('/activities') },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 16px', color: item.active ? '#1E88E5' : '#94a3b8', position: 'relative' }}>
            {item.icon}
            {(item as any).badge > 0 && (
              <div style={{ position: 'absolute', top: 0, right: 10, width: 16, height: 16, borderRadius: '50%', background: '#FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{(item as any).badge}</span>
              </div>
            )}
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            {item.active && <motion.div layoutId="friends-nav-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#1E88E5', marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>
    </div>
  );
};