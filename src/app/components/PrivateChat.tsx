import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Lock, Loader2, Check, CheckCheck } from 'lucide-react';
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
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIds = useRef<Set<string>>(new Set());

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

      const { data: msgs } = await supabase
        .from('private_messages').select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${traveler.user_id}),and(from_user_id.eq.${traveler.user_id},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);

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

  // Realtime
  useEffect(() => {
    if (!currentUserId || !traveler) return;
    const channel = supabase.channel(`private-${currentUserId}-${traveler.user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.from_user_id === currentUserId && msg.to_user_id === traveler.user_id) ||
            (msg.from_user_id === traveler.user_id && msg.to_user_id === currentUserId);

          if (!isRelevant) return;

          setMessages(prev => {
            // Replace optimistic message if it's ours
            if (pendingIds.current.has(msg.id)) {
              pendingIds.current.delete(msg.id);
              return prev.map(m => m.id === msg.id ? { ...msg, pending: false } : m);
            }
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Mark as seen if from other person
          if (msg.from_user_id === traveler.user_id) {
            await supabase.from('private_messages').update({ is_seen: true }).eq('id', msg.id);
          }
          scrollToBottom();
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'private_messages' },
        (payload) => {
          // Update seen status in real time
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id ? { ...m, is_seen: payload.new.is_seen } : m
          ));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, traveler, scrollToBottom]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentUserId || !traveler || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // ── Optimistic update ──
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      from_user_id: currentUserId,
      to_user_id: traveler.user_id,
      from_name: currentName,
      text,
      created_at: new Date().toISOString(),
      is_seen: false,
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const { data, error } = await supabase.from('private_messages').insert({
      from_user_id: currentUserId,
      to_user_id: traveler.user_id,
      from_name: currentName,
      text,
    }).select().single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error('Failed to send');
      setMessageText(text);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, pending: false } : m));
      pendingIds.current.add(data.id);
      notify.message(traveler.user_id, currentName);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  // Group by date
  const groupedMessages = messages.reduce((groups: { date: string; msgs: Message[] }[], msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groups.push({ date, msgs: [msg] });
    return groups;
  }, []);

  if (!traveler) return null;
  const travelerInitials = traveler.name.split(' ').map((n: string) => n[0]).join('');

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
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%',
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.1)', boxShadow: '0 2px 12px rgba(30,136,229,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge/travelers')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#1E88E5' }} />
          </motion.button>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(30,136,229,0.25)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{travelerInitials}</span>
            </div>
            {/* Online dot */}
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>{traveler.name}</h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{traveler.profession}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '4px 8px' }}>
            <Lock style={{ width: 11, height: 11, color: '#16a34a' }} />
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Private</span>
          </div>
        </div>

        {/* Private note */}
        <div style={{ marginTop: 10, background: 'rgba(30,136,229,0.04)', border: '1px solid rgba(30,136,229,0.1)', borderRadius: 10, padding: '6px 12px' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
            🔒 End-to-end private — messages deleted after your journey ends
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(30,136,229,0.08)', border: '1.5px solid rgba(30,136,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>👋</span>
            </motion.div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Start chatting with {traveler.name}</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Your conversation is private and secure</p>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
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

                        {/* Avatar */}
                        {!isOwn && (
                          <div style={{ flexShrink: 0, width: 32, marginBottom: 2 }}>
                            {showAvatar
                              ? <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,136,229,0.2)' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{travelerInitials}</span></div>
                              : <div style={{ width: 32 }} />
                            }
                          </div>
                        )}

                        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          {/* Bubble */}
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                            background: isOwn ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(255,255,255,0.95)',
                            border: isOwn ? 'none' : '1px solid rgba(148,163,184,0.15)',
                            boxShadow: isOwn ? '0 4px 16px rgba(30,136,229,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
                          }}>
                            <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.55, wordBreak: 'break-word' }}>{message.text}</p>
                          </div>

                          {/* Time + read receipt */}
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

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`Message ${traveler.name}...`}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            style={{
              flex: 1, height: 46, borderRadius: 23,
              border: '1.5px solid rgba(30,136,229,0.2)',
              background: 'rgba(255,255,255,0.95)',
              padding: '0 18px', fontSize: 14, color: '#0f172a',
              outline: 'none', fontFamily: 'system-ui, sans-serif',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(30,136,229,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(30,136,229,0.2)'}
          />
          <motion.button type="submit" whileTap={{ scale: 0.88 }} disabled={!messageText.trim() || sending}
            style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none',
              cursor: messageText.trim() ? 'pointer' : 'default',
              background: messageText.trim() ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(148,163,184,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: messageText.trim() ? '0 4px 16px rgba(30,136,229,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
            {sending
              ? <Loader2 style={{ width: 16, height: 16, color: '#fff' }} className="animate-spin" />
              : <Send style={{ width: 15, height: 15, color: messageText.trim() ? '#fff' : '#94a3b8', marginLeft: 1 }} />
            }
          </motion.button>
        </form>
      </div>
    </div>
  );
};