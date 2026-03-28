import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Lock, Loader2, Check, CheckCheck, Flag, Ban, MoreVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  text: string;
  created_at: string;
  is_seen: boolean;
  pending?: boolean;
}

interface TravelerData {
  id?: string;
  user_id: string;
  name: string;
  profession: string;
  avatar_url?: string;
}

const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment or abuse',
  'Fake profile',
  'Spam',
  'Making me uncomfortable',
  'Other',
];

export const PrivateChat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const traveler: TravelerData = location.state?.traveler || location.state?.user;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState('');
  const [travelerAvatar, setTravelerAvatar] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  // Report/Block state
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIds = useRef<Set<string>>(new Set());
  const messageIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  }, []);

  useEffect(() => {
    if (!traveler) { navigate('/lounge'); return; }
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setCurrentUserId(user.id);

      const { data: checkin } = await supabase
        .from('checkins').select('name')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (checkin) setCurrentName(checkin.name);

      const { data: myProfile } = await supabase
        .from('user_profiles').select('avatar_url')
        .eq('user_id', user.id).maybeSingle();
      setCurrentAvatar(myProfile?.avatar_url || user.user_metadata?.avatar_url || '');

      const { data: theirProfile } = await supabase
        .from('user_profiles').select('avatar_url')
        .eq('user_id', traveler.user_id).maybeSingle();
      setTravelerAvatar(theirProfile?.avatar_url || traveler.avatar_url || '');

      // Check if already blocked in either direction
      const { data: blockData } = await supabase
        .from('blocked_users').select('id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${traveler.user_id}),and(blocker_id.eq.${traveler.user_id},blocked_id.eq.${user.id})`)
        .limit(1);
      
      const actuallyBlocked = !!(blockData && blockData.length > 0);
      setIsBlocked(actuallyBlocked);

      const { data: msgs } = await supabase
        .from('private_messages').select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${traveler.user_id}),and(from_user_id.eq.${traveler.user_id},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      const fetchedMsgs = msgs || [];
      fetchedMsgs.forEach(m => messageIds.current.add(m.id));
      setMessages(fetchedMsgs);

      await supabase.from('private_messages')
        .update({ is_seen: true })
        .eq('from_user_id', traveler.user_id)
        .eq('to_user_id', user.id)
        .eq('is_seen', false);

      setLoading(false);
      scrollToBottom('instant');
    };
    init();
  }, [navigate, traveler, scrollToBottom]);

  useEffect(() => {
    if (!currentUserId || !traveler) return;
    const channelId = [currentUserId, traveler.user_id].sort().join('-');
    const channel = supabase.channel(`private-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.from_user_id === currentUserId && msg.to_user_id === traveler.user_id) ||
            (msg.from_user_id === traveler.user_id && msg.to_user_id === currentUserId);
          
          if (!isRelevant || isBlocked) return;
          if (messageIds.current.has(msg.id)) {
            if (pendingIds.current.has(msg.id)) {
              pendingIds.current.delete(msg.id);
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...msg, pending: false } : m));
            }
            return;
          }
          messageIds.current.add(msg.id);
          setMessages(prev => {
            const tempMatch = [...pendingIds.current].find(pid => pid.startsWith('temp-'));
            if (tempMatch && msg.from_user_id === currentUserId) {
              pendingIds.current.delete(tempMatch);
              return prev.map(m => m.id === tempMatch ? { ...msg, pending: false } : m);
            }
            return [...prev, msg];
          });
          if (msg.from_user_id === traveler.user_id) {
            await supabase.from('private_messages').update({ is_seen: true }).eq('id', msg.id);
          }
          scrollToBottom();
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'private_messages' },
        (payload) => {
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id ? { ...m, is_seen: payload.new.is_seen } : m
          ));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, traveler, scrollToBottom, isBlocked]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentUserId || !traveler || sending || isBlocked) return;
    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // Check if I am banned
    const { data: profile } = await supabase.from('user_profiles').select('is_banned').eq('user_id', currentUserId).maybeSingle();
    if (profile?.is_banned) {
      toast.error('Your account is banned.');
      setIsBlocked(true);
      setSending(false);
      return;
    }

    // ACTIVE PRE-FLIGHT BLOCK CHECK
    const { data: blockRecords } = await supabase.from('blocked_users').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`);

    const isBlockedNow = blockRecords?.some(b => b.blocker_id === traveler.user_id || b.blocked_id === traveler.user_id);

    if (isBlockedNow) {
      toast.error('Cannot send message to this user');
      setIsBlocked(true);
      setSending(false);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId, from_user_id: currentUserId, to_user_id: traveler.user_id,
      from_name: currentName, text, created_at: new Date().toISOString(), is_seen: false, pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const { data, error } = await supabase.from('private_messages').insert({
      from_user_id: currentUserId, to_user_id: traveler.user_id, from_name: currentName, text,
    }).select().single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error('Failed to send');
      setMessageText(text);
    } else if (data) {
      messageIds.current.add(data.id);
      pendingIds.current.add(data.id);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, pending: false } : m));
      notify.message(traveler.user_id, currentName);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  // ── Report ────────────────────────────────────────────────
  const handleReport = async () => {
    if (!reportReason || !currentUserId) return;
    setReportLoading(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_id: traveler.user_id,
      reason: reportReason,
      context: `Private Chat`,
      status: 'pending',
    });
    if (!error) {
      toast.success(`${traveler.name} reported. Our team will review. 🛡️`);
      setShowReportModal(false);
      setShowMenu(false);
      setReportReason('');
    } else {
      toast.error('Failed to submit report');
    }
    setReportLoading(false);
  };

  // ── Block ─────────────────────────────────────────────────
  const handleBlock = async () => {
    if (!currentUserId) return;
    const { error } = await supabase.from('blocked_users').insert({
      blocker_id: currentUserId,
      blocked_id: traveler.user_id,
    });
    if (!error) {
      setIsBlocked(true);
      setShowMenu(false);
      toast.success(`${traveler.name} blocked. You won't see them anymore.`);
    } else {
      toast.error('Failed to block user');
    }
  };

  // ── Unblock ───────────────────────────────────────────────
  const handleUnblock = async () => {
    if (!currentUserId) return;
    const { error } = await supabase.from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', traveler.user_id);
    if (!error) {
      setIsBlocked(false);
      setShowMenu(false);
      toast.success(`${traveler.name} unblocked.`);
    }
  };

  // ── Avatar ────────────────────────────────────────────────
  const Avatar = ({ name, avatarUrl, size = 32 }: { name: string; avatarUrl?: string; size?: number }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    if (avatarUrl && !imgFailed) {
      return (
        <img src={avatarUrl} alt={name} onError={() => setImgFailed(true)}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(30,136,229,0.2)', flexShrink: 0 }} />
      );
    }
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: size * 0.34, fontWeight: 700, color: '#fff' }}>{initials}</span>
      </div>
    );
  };

  const groupedMessages = messages.reduce((groups: { date: string; msgs: Message[] }[], msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groups.push({ date, msgs: [msg] });
    return groups;
  }, []);

  if (!traveler) return null;
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative' }}>

      {/* ── REPORT MODAL ── */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setShowReportModal(false)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flag style={{ width: 16, height: 16, color: '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Report {traveler.name}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>This will be reviewed by our team</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowReportModal(false)}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(148,163,184,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: 14, height: 14, color: '#64748b' }} />
                </motion.button>
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Select reason</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {REPORT_REASONS.map(reason => (
                  <motion.button key={reason} whileTap={{ scale: 0.98 }}
                    onClick={() => setReportReason(reason)}
                    style={{ padding: '12px 16px', borderRadius: 12, border: reportReason === reason ? '2px solid #ef4444' : '1.5px solid rgba(148,163,184,0.2)', background: reportReason === reason ? 'rgba(239,68,68,0.06)' : 'rgba(248,250,252,1)', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: reportReason === reason ? '#dc2626' : '#374151', fontWeight: reportReason === reason ? 600 : 400, transition: 'all 0.15s' }}>
                    {reason}
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleReport}
                disabled={!reportReason || reportLoading}
                style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: reportReason ? 'pointer' : 'default', background: reportReason ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(148,163,184,0.15)', color: reportReason ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {reportLoading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Flag style={{ width: 16, height: 16 }} />}
                {reportLoading ? 'Submitting...' : 'Submit Report'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MENU DROPDOWN ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
            style={{ position: 'absolute', top: 70, right: 16, zIndex: 50, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid rgba(148,163,184,0.15)', overflow: 'hidden', minWidth: 180 }}>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { setShowMenu(false); setShowReportModal(true); setReportReason(''); }}
              style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#ef4444', fontWeight: 500 }}>
              <Flag style={{ width: 15, height: 15 }} /> Report {traveler.name}
            </motion.button>
            <div style={{ height: 1, background: 'rgba(148,163,184,0.1)' }} />
            {isBlocked ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleUnblock}
                style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#16a34a', fontWeight: 500 }}>
                <Ban style={{ width: 15, height: 15 }} /> Unblock {traveler.name}
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleBlock}
                style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                <Ban style={{ width: 15, height: 15 }} /> Block {traveler.name}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Backdrop to close menu ── */}
      {showMenu && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
      )}

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.1)', boxShadow: '0 2px 12px rgba(30,136,229,0.08)', position: 'relative', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge/travelers')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#1E88E5' }} />
          </motion.button>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={traveler.name} avatarUrl={travelerAvatar} size={44} />
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>{traveler.name}</h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{traveler.profession}</p>
          </div>

          {/* ── 3-dot menu button ── */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowMenu(!showMenu)}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MoreVertical style={{ width: 16, height: 16, color: '#64748b' }} />
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '4px 8px', flexShrink: 0 }}>
            <Lock style={{ width: 11, height: 11, color: '#16a34a' }} />
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Private</span>
          </div>
        </div>

        <div style={{ marginTop: 10, background: 'rgba(30,136,229,0.04)', border: '1px solid rgba(30,136,229,0.08)', borderRadius: 10, padding: '6px 12px' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
            🔒 Private — messages deleted after your journey ends
          </p>
        </div>

        {/* Blocked banner */}
        {isBlocked && (
          <div style={{ marginTop: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>🚫 You've blocked {traveler.name}</span>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleUnblock}
              style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}>
              Unblock
            </motion.button>
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
              <Avatar name={traveler.name} avatarUrl={travelerAvatar} size={64} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Start chatting with {traveler.name}</p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>{traveler.profession}</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Private & secure 🔒</p>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.2)' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{group.date}</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.2)' }} />
                </div>

                <AnimatePresence mode="popLayout">
                  {group.msgs.map((message, index) => {
                    const isOwn = message.from_user_id === currentUserId;
                    const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const prevMsg = group.msgs[index - 1];
                    const nextMsg = group.msgs[index + 1];
                    const showAvatar = !isOwn && (!prevMsg || prevMsg.from_user_id !== message.from_user_id);
                    const isLastInGroup = !nextMsg || nextMsg.from_user_id !== message.from_user_id;

                    return (
                      <motion.div key={message.id}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: message.pending ? 0.7 : 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', marginBottom: isLastInGroup ? 10 : 3, alignItems: 'flex-end', gap: 8 }}>

                        {!isOwn && (
                          <div style={{ flexShrink: 0, width: 32, marginBottom: 2 }}>
                            {showAvatar ? <Avatar name={traveler.name} avatarUrl={travelerAvatar} size={32} /> : <div style={{ width: 32 }} />}
                          </div>
                        )}

                        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                            background: isOwn ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(255,255,255,0.95)',
                            border: isOwn ? 'none' : '1px solid rgba(148,163,184,0.15)',
                            boxShadow: isOwn ? '0 4px 16px rgba(30,136,229,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
                          }}>
                            <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.55, wordBreak: 'break-word' }}>{message.text}</p>
                          </div>

                          {isLastInGroup && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>{time}</span>
                              {isOwn && (
                                message.pending
                                  ? <Check style={{ width: 11, height: 11, color: '#94a3b8' }} />
                                  : message.is_seen
                                    ? <CheckCheck style={{ width: 12, height: 12, color: '#1E88E5' }} />
                                    : <CheckCheck style={{ width: 12, height: 12, color: '#94a3b8' }} />
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* ── Input ── */}
      <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar name={currentName} avatarUrl={currentAvatar} size={36} />
          <input ref={inputRef} type="text"
            placeholder={isBlocked ? `You blocked ${traveler.name}` : `Message ${traveler.name}...`}
            value={messageText} onChange={e => setMessageText(e.target.value)}
            disabled={isBlocked}
            style={{ flex: 1, height: 46, borderRadius: 23, border: `1.5px solid ${isBlocked ? 'rgba(239,68,68,0.2)' : 'rgba(30,136,229,0.2)'}`, background: isBlocked ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.95)', padding: '0 18px', fontSize: 14, color: '#0f172a', outline: 'none', fontFamily: 'system-ui, sans-serif', transition: 'border-color 0.2s', cursor: isBlocked ? 'not-allowed' : 'text' }}
            onFocus={e => { if (!isBlocked) e.target.style.borderColor = 'rgba(30,136,229,0.5)'; }}
            onBlur={e => { if (!isBlocked) e.target.style.borderColor = 'rgba(30,136,229,0.2)'; }} />
          <motion.button type="submit" whileTap={{ scale: 0.88 }} disabled={!messageText.trim() || sending || isBlocked}
            style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: messageText.trim() && !isBlocked ? 'pointer' : 'default', background: messageText.trim() && !isBlocked ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(148,163,184,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: messageText.trim() && !isBlocked ? '0 4px 16px rgba(30,136,229,0.3)' : 'none', transition: 'all 0.2s' }}>
            {sending ? <Loader2 style={{ width: 16, height: 16, color: '#fff' }} className="animate-spin" /> : <Send style={{ width: 15, height: 15, color: messageText.trim() && !isBlocked ? '#fff' : '#94a3b8', marginLeft: 1 }} />}
          </motion.button>
        </form>
      </div>
    </div>
  );
};