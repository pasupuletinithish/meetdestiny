import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Users, MapPin, Loader2, BellOff, Bell, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  text: string;
  created_at: string;
  pending?: boolean; // optimistic flag
}

interface CheckinData {
  user_id: string;
  name: string;
  profession: string;
  vehicle_id: string;
  to_location: string;
}

export const GroupChat: React.FC<{ mode: 'group' | 'destination' }> = ({ mode }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIds = useRef<Set<string>>(new Set());

  const isGroup = mode === 'group';
  const accentColor = isGroup ? '#FF6B35' : '#7c3aed';
  const accentGlow = isGroup ? 'rgba(255,107,53,0.2)' : 'rgba(124,58,237,0.2)';
  const tableName = isGroup ? 'lounge_messages' : 'destination_messages';
  const filterField = isGroup ? 'vehicle_id' : 'destination';

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setCurrentUserId(user.id);

      const { data: checkin } = await supabase
        .from('checkins').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!checkin) { navigate('/check-in'); return; }
      setCurrentCheckin(checkin);

      const chatId = isGroup ? checkin.vehicle_id : checkin.to_location;

      const { data: msgs } = await supabase
        .from(tableName).select('*')
        .eq(filterField, chatId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);

      const { count } = await supabase
        .from('checkins').select('*', { count: 'exact', head: true })
        .eq(isGroup ? 'vehicle_id' : 'to_location', chatId)
        .eq('is_active', true);
      setMemberCount(count || 0);

      const { data: mute } = await supabase
        .from('muted_chats').select('*')
        .eq('user_id', user.id).eq('chat_type', mode).eq('chat_id', chatId)
        .maybeSingle();
      setIsMuted(!!mute);

      setLoading(false);
      scrollToBottom('instant');
    };
    init();
  }, [navigate, mode, isGroup, tableName, filterField, scrollToBottom]);

  // Realtime — only add messages NOT already in state (avoids duplicates with optimistic)
  useEffect(() => {
    if (!currentCheckin) return;
    const chatId = isGroup ? currentCheckin.vehicle_id : currentCheckin.to_location;

    const channel = supabase.channel(`${mode}-chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: tableName,
        filter: `${filterField}=eq.${chatId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          // If this is a pending optimistic message from us, replace it
          if (pendingIds.current.has(newMsg.id)) {
            pendingIds.current.delete(newMsg.id);
            return prev.map(m => m.id === newMsg.id ? { ...newMsg, pending: false } : m);
          }
          // Skip if already exists
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, mode, isGroup, tableName, filterField, scrollToBottom]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentCheckin || !currentUserId || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // ── Optimistic update — show message instantly ──
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      user_id: currentUserId,
      name: currentCheckin.name,
      profession: currentCheckin.profession,
      text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const payload: Record<string, string> = {
      user_id: currentUserId,
      name: currentCheckin.name,
      profession: currentCheckin.profession,
      text,
    };
    if (isGroup) payload.vehicle_id = currentCheckin.vehicle_id;
    else payload.destination = currentCheckin.to_location;

    const { data, error } = await supabase.from(tableName).insert(payload).select().single();

    if (error) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error('Failed to send message');
      setMessageText(text);
    } else if (data) {
      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, pending: false } : m));
      pendingIds.current.add(data.id); // mark so realtime doesn't duplicate
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const toggleMute = async () => {
    if (!currentCheckin || !currentUserId) return;
    const chatId = isGroup ? currentCheckin.vehicle_id : currentCheckin.to_location;
    if (isMuted) {
      await supabase.from('muted_chats').delete()
        .eq('user_id', currentUserId).eq('chat_type', mode).eq('chat_id', chatId);
      setIsMuted(false);
      toast.success('Notifications enabled');
    } else {
      await supabase.from('muted_chats').insert({ user_id: currentUserId, chat_type: mode, chat_id: chatId });
      setIsMuted(true);
      toast.success('Chat muted');
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; msgs: Message[] }[], msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groups.push({ date, msgs: [msg] });
    }
    return groups;
  }, []);

  const chatTitle = isGroup
    ? `${currentCheckin?.vehicle_id} Group`
    : `${currentCheckin?.to_location} Chat`;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <Loader2 style={{ width: 32, height: 32, color: accentColor }} className="animate-spin" />
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
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: `2px solid ${accentColor}20`, boxShadow: `0 2px 12px ${accentGlow}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge')}
            style={{ width: 36, height: 36, borderRadius: 10, background: `${accentColor}15`, border: `1px solid ${accentColor}25`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: accentColor }} />
          </motion.button>

          <div style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${accentGlow}` }}>
            {isGroup ? <Users style={{ width: 18, height: 18, color: '#fff' }} /> : <MapPin style={{ width: 18, height: 18, color: '#fff' }} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatTitle}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>{memberCount} members</span>
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.9 }} onClick={toggleMute}
            style={{ width: 36, height: 36, borderRadius: 10, background: isMuted ? 'rgba(148,163,184,0.12)' : `${accentColor}12`, border: `1px solid ${isMuted ? 'rgba(148,163,184,0.2)' : `${accentColor}25`}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMuted ? <BellOff style={{ width: 15, height: 15, color: '#94a3b8' }} /> : <Bell style={{ width: 15, height: 15, color: accentColor }} />}
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 56, height: 56, borderRadius: '50%', background: `${accentColor}12`, border: `1.5px solid ${accentColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {isGroup ? <Users style={{ width: 24, height: 24, color: accentColor }} /> : <MapPin style={{ width: 24, height: 24, color: accentColor }} />}
            </motion.div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Start the conversation</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Be the first to say hello! 👋</p>
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
                    const isOwn = message.user_id === currentUserId;
                    const initials = message.name.split(' ').map((n: string) => n[0]).join('');
                    const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const prevMsg = group.msgs[index - 1];
                    const nextMsg = group.msgs[index + 1];
                    const showHeader = !prevMsg || prevMsg.user_id !== message.user_id;
                    const isLastInGroup = !nextMsg || nextMsg.user_id !== message.user_id;

                    return (
                      <motion.div key={message.id}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: message.pending ? 0.7 : 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: 8, marginBottom: isLastInGroup ? 10 : 3, alignItems: 'flex-end' }}>

                        {/* Avatar */}
                        {!isOwn && (
                          <div style={{ flexShrink: 0, width: 32, marginBottom: 2 }}>
                            {showHeader ? (
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${accentGlow}` }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</span>
                              </div>
                            ) : <div style={{ width: 32 }} />}
                          </div>
                        )}

                        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          {/* Name + profession header */}
                          {!isOwn && showHeader && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{message.name}</span>
                              <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '1px 7px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)' }}>{message.profession}</span>
                            </div>
                          )}

                          {/* Bubble */}
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn
                              ? `18px 4px 18px 18px`
                              : `4px 18px 18px 18px`,
                            background: isOwn
                              ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`
                              : 'rgba(255,255,255,0.95)',
                            border: isOwn ? 'none' : `1px solid rgba(148,163,184,0.15)`,
                            boxShadow: isOwn ? `0 4px 16px ${accentGlow}` : '0 2px 8px rgba(0,0,0,0.06)',
                          }}>
                            <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.55, wordBreak: 'break-word' }}>{message.text}</p>
                          </div>

                          {/* Time + status */}
                          {isLastInGroup && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>{time}</span>
                              {isOwn && (
                                message.pending
                                  ? <Check style={{ width: 11, height: 11, color: '#94a3b8' }} />
                                  : <CheckCheck style={{ width: 12, height: 12, color: accentColor }} />
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

      {/* Muted banner */}
      {isMuted && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ flexShrink: 0, textAlign: 'center', padding: '6px 16px', background: 'rgba(148,163,184,0.08)', borderTop: '1px solid rgba(148,163,184,0.1)' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>🔕 Muted — you can still send messages</span>
        </motion.div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${accentColor}12` }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`Message ${chatTitle}...`}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            style={{
              flex: 1, height: 46, borderRadius: 23,
              border: `1.5px solid ${accentColor}25`,
              background: 'rgba(255,255,255,0.95)',
              padding: '0 18px', fontSize: 14, color: '#0f172a',
              outline: 'none', fontFamily: 'system-ui, sans-serif',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = `${accentColor}60`}
            onBlur={e => e.target.style.borderColor = `${accentColor}25`}
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.88 }}
            disabled={!messageText.trim() || sending}
            style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none',
              cursor: messageText.trim() ? 'pointer' : 'default',
              background: messageText.trim()
                ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`
                : 'rgba(148,163,184,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: messageText.trim() ? `0 4px 16px ${accentGlow}` : 'none',
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

export const VehicleGroupChat: React.FC = () => <GroupChat mode="group" />;
export const DestinationChat: React.FC = () => <GroupChat mode="destination" />;