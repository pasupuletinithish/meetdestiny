import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Lock, Loader2 } from 'lucide-react';
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

      // Mark incoming as seen
      await supabase.from('private_messages')
        .update({ is_seen: true })
        .eq('from_user_id', traveler.user_id)
        .eq('to_user_id', user.id)
        .eq('is_seen', false);

      setLoading(false);
    };
    init();
  }, [navigate, traveler]);

  // Realtime
  useEffect(() => {
    if (!currentUserId || !traveler) return;
    const channel = supabase.channel('private-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.from_user_id === currentUserId && msg.to_user_id === traveler.user_id) ||
            (msg.from_user_id === traveler.user_id && msg.to_user_id === currentUserId);
          if (isRelevant) {
            setMessages(prev => [...prev, msg]);
            if (msg.from_user_id === traveler.user_id) {
              await supabase.from('private_messages').update({ is_seen: true }).eq('id', msg.id);
            }
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, traveler]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentUserId || !traveler || sending) return;
    setSending(true);
    const text = messageText.trim();
    setMessageText('');

    const { error } = await supabase.from('private_messages').insert({
      from_user_id: currentUserId,
      to_user_id: traveler.user_id,
      from_name: currentName,
      text,
    });

    if (error) {
      toast.error('Failed to send');
      setMessageText(text);
    } else {
      notify.message(traveler.user_id, currentName);
    }

    setSending(false);
    inputRef.current?.focus();
  };

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
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/lounge/travelers')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#1E88E5' }} />
          </motion.button>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(30,136,229,0.25)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{travelerInitials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>{traveler.name}</h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{traveler.profession}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', borderRadius: 8, padding: '4px 8px' }}>
            <Lock style={{ width: 11, height: 11, color: '#1E88E5' }} />
            <span style={{ fontSize: 10, color: '#1E88E5', fontWeight: 600 }}>Private</span>
          </div>
        </div>
        <div style={{ marginTop: 10, background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.12)', borderRadius: 10, padding: '6px 12px' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
            🔒 Private chat — messages deleted after your journey ends
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'none' }}>
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(30,136,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>👋</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>Start chatting with {traveler.name}</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Your conversation is private and secure</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => {
              const isOwn = message.from_user_id === currentUserId;
              const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const prevMsg = messages[index - 1];
              const showAvatar = !isOwn && (!prevMsg || prevMsg.from_user_id !== message.from_user_id);

              return (
                <motion.div key={message.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', marginBottom: showAvatar ? 12 : 4, alignItems: 'flex-end', gap: 8 }}>
                  {!isOwn && (
                    <div style={{ flexShrink: 0, marginBottom: 2 }}>
                      {showAvatar
                        ? <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{travelerInitials}</span></div>
                        : <div style={{ width: 28 }} />
                      }
                    </div>
                  )}
                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isOwn ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(255,255,255,0.9)',
                      border: isOwn ? 'none' : '1px solid rgba(30,136,229,0.1)',
                      boxShadow: isOwn ? '0 4px 12px rgba(30,136,229,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.5 }}>{message.text}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{time}</span>
                      {isOwn && <span style={{ fontSize: 10, color: message.is_seen ? '#1E88E5' : '#94a3b8' }}>{message.is_seen ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={inputRef} type="text" placeholder={`Message ${traveler.name}...`}
            value={messageText} onChange={e => setMessageText(e.target.value)}
            style={{ flex: 1, height: 44, borderRadius: 22, border: '1.5px solid rgba(30,136,229,0.15)', background: 'rgba(255,255,255,0.9)', padding: '0 16px', fontSize: 14, color: '#0f172a', outline: 'none', fontFamily: 'system-ui, sans-serif' }}
            onFocus={e => e.target.style.borderColor = 'rgba(30,136,229,0.4)'}
            onBlur={e => e.target.style.borderColor = 'rgba(30,136,229,0.15)'}
          />
          <motion.button type="submit" whileTap={{ scale: 0.9 }} disabled={!messageText.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: messageText.trim() ? 'pointer' : 'default', background: messageText.trim() ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : 'rgba(148,163,184,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: messageText.trim() ? '0 4px 12px rgba(30,136,229,0.3)' : 'none', transition: 'all 0.2s' }}>
            {sending ? <Loader2 style={{ width: 16, height: 16, color: '#fff' }} className="animate-spin" /> : <Send style={{ width: 15, height: 15, color: messageText.trim() ? '#fff' : '#94a3b8', marginLeft: 1 }} />}
          </motion.button>
        </form>
      </div>
    </div>
  );
};