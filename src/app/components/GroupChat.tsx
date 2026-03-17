import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Users, MapPin, Loader2, BellOff, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  text: string;
  created_at: string;
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

  const isGroup = mode === 'group';
  const accentColor = isGroup ? '#FF6B35' : '#7c3aed';
  const accentGlow = isGroup ? 'rgba(255,107,53,0.2)' : 'rgba(124,58,237,0.2)';
  const tableName = isGroup ? 'lounge_messages' : 'destination_messages';
  const filterField = isGroup ? 'vehicle_id' : 'destination';

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

      // Fetch messages
      const { data: msgs } = await supabase
        .from(tableName).select('*')
        .eq(filterField, chatId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);

      // Member count
      const { count } = await supabase
        .from('checkins').select('*', { count: 'exact', head: true })
        .eq(isGroup ? 'vehicle_id' : 'to_location', chatId)
        .eq('is_active', true);
      setMemberCount(count || 0);

      // Mute status
      const { data: mute } = await supabase
        .from('muted_chats').select('*')
        .eq('user_id', user.id)
        .eq('chat_type', mode)
        .eq('chat_id', chatId)
        .maybeSingle();
      setIsMuted(!!mute);

      setLoading(false);
    };
    init();
  }, [navigate, mode, isGroup, tableName, filterField]);

  // Realtime
  useEffect(() => {
    if (!currentCheckin) return;
    const chatId = isGroup ? currentCheckin.vehicle_id : currentCheckin.to_location;

    const channel = supabase.channel(`${mode}-chat`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: tableName,
        filter: `${filterField}=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, mode, isGroup, tableName, filterField]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentCheckin || !currentUserId || sending) return;

    setSending(true);
    const text = messageText.trim();
    setMessageText('');

    const payload: Record<string, string> = {
      user_id: currentUserId,
      name: currentCheckin.name,
      profession: currentCheckin.profession,
      text,
    };

    if (isGroup) payload.vehicle_id = currentCheckin.vehicle_id;
    else payload.destination = currentCheckin.to_location;

    const { error } = await supabase.from(tableName).insert(payload);
    if (error) { toast.error('Failed to send'); setMessageText(text); }
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

  const chatTitle = isGroup
    ? `${currentCheckin?.vehicle_id} Group`
    : `${currentCheckin?.to_location} Chat`;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)' }}>
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
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${accentColor}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge')}
            style={{ width: 36, height: 36, borderRadius: 10, background: `${accentColor}15`, border: `1px solid ${accentColor}25`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: accentColor }} />
          </motion.button>

          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${accentGlow}` }}>
            {isGroup ? <Users style={{ width: 18, height: 18, color: '#fff' }} /> : <MapPin style={{ width: 18, height: 18, color: '#fff' }} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatTitle}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }} />
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'none' }}>
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 52, height: 52, borderRadius: '50%', background: `${accentColor}12`, border: `1.5px solid ${accentColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              {isGroup ? <Users style={{ width: 22, height: 22, color: accentColor }} /> : <MapPin style={{ width: 22, height: 22, color: accentColor }} />}
            </motion.div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>Start the conversation</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Be the first to say hello! 👋</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => {
              const isOwn = message.user_id === currentUserId;
              const initials = message.name.split(' ').map((n: string) => n[0]).join('');
              const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const prevMsg = messages[index - 1];
              const showHeader = !prevMsg || prevMsg.user_id !== message.user_id;

              return (
                <motion.div key={message.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: 8, marginBottom: showHeader ? 12 : 4, alignItems: 'flex-end' }}>

                  {!isOwn && (
                    <div style={{ flexShrink: 0, marginBottom: 2 }}>
                      {showHeader ? (
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</span>
                        </div>
                      ) : <div style={{ width: 30 }} />}
                    </div>
                  )}

                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    {!isOwn && showHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{message.name}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(148,163,184,0.12)', padding: '1px 6px', borderRadius: 8 }}>{message.profession}</span>
                      </div>
                    )}
                    <div style={{
                      padding: '9px 13px', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isOwn ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})` : 'rgba(255,255,255,0.9)',
                      border: isOwn ? 'none' : `1px solid ${accentColor}15`,
                      boxShadow: isOwn ? `0 4px 12px ${accentGlow}` : '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.5 }}>{message.text}</p>
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>{time}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${accentColor}12` }}>
        {isMuted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '6px 0', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>🔕 This chat is muted — you can still send messages</span>
          </motion.div>
        )}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={inputRef} type="text" placeholder={`Message ${chatTitle}...`}
            value={messageText} onChange={e => setMessageText(e.target.value)}
            style={{
              flex: 1, height: 44, borderRadius: 22, border: `1.5px solid ${accentColor}20`,
              background: 'rgba(255,255,255,0.9)', padding: '0 16px', fontSize: 14, color: '#0f172a',
              outline: 'none', fontFamily: 'system-ui, sans-serif',
            }}
            onFocus={e => e.target.style.borderColor = `${accentColor}50`}
            onBlur={e => e.target.style.borderColor = `${accentColor}20`}
          />
          <motion.button type="submit" whileTap={{ scale: 0.9 }} disabled={!messageText.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: messageText.trim() ? 'pointer' : 'default',
              background: messageText.trim() ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})` : 'rgba(148,163,184,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: messageText.trim() ? `0 4px 12px ${accentGlow}` : 'none',
              transition: 'all 0.2s',
            }}>
            {sending ? <Loader2 style={{ width: 16, height: 16, color: '#fff' }} className="animate-spin" />
              : <Send style={{ width: 15, height: 15, color: messageText.trim() ? '#fff' : '#94a3b8', marginLeft: 1 }} />}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

// Named exports for routing
export const VehicleGroupChat: React.FC = () => <GroupChat mode="group" />;
export const DestinationChat: React.FC = () => <GroupChat mode="destination" />;