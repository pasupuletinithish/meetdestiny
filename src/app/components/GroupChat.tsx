import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Users, MapPin, Loader2, BellOff, Bell, Check, CheckCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  text: string;
  avatar_url?: string;
  created_at: string;
  pending?: boolean;
  is_ai?: boolean;
  is_flagged?: boolean;
}

interface CheckinData {
  user_id: string;
  name: string;
  profession: string;
  vehicle_id: string;
  to_location: string;
  avatar_url?: string;
}

// ── Groq AI Moderation ────────────────────────────────────────
const moderateMessage = async (
  text: string,
  userName: string,
  warnCount: number
): Promise<{
  allowed: boolean;
  shouldWarn: boolean;
  shouldBlock: boolean;
  aiReply: string;
}> => {
  console.log('🤖 Moderating:', text);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are MeetDestiny's AI safety moderator for an Indian travel social app.
Your job is to moderate group chat messages between travelers on buses and trains in India.

Analyze messages for:
- Abusive language, slurs, hate speech
- Sexual harassment or inappropriate content (e.g. "sexy", "hot figure", suggestive compliments to strangers)
- Spam or fake/irrelevant content
- Scam attempts or suspicious links
- Threats or violent content

Regional context: Messages may be in Hindi, Telugu, Tamil, Kannada, Malayalam or English. Understand regional slang.

Respond ONLY with this exact JSON:
{
  "allowed": true/false,
  "violation_type": "none" | "mild" | "severe",
  "ai_reply": "your sarcastic/funny reply in English if violation, empty string if allowed"
}

Rules:
- "allowed": false for ANY sexual comment, harassment, or inappropriate compliment to strangers
- "mild" = first warning worthy (mild abuse, borderline content, inappropriate compliments)
- "severe" = instant action worthy (explicit sexual content, threats, slurs)
- ai_reply must be witty, sarcastic and short (max 15 words) if violation
- ai_reply examples:
  "Oh wow, groundbreaking vocabulary! Maybe try actual words? 🙄"
  "Congrats on finding the block button so fast! 🏆"
  "This isn't that kind of journey, friend. Try again. 👋"
  "Our AI is embarrassed for you. Really. 😬"
  "Sir this is a travel app, not a dating app. 😂"
- Normal travel chat, greetings, questions are ALWAYS allowed`,
          },
          {
            role: 'user',
            content: `Message from "${userName}" (previous warnings: ${warnCount}): "${text}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    console.log('Groq response:', JSON.stringify(data));
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { allowed: true, shouldWarn: false, shouldBlock: false, aiReply: '' };

    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const isViolation = !parsed.allowed;
    const isSevere = parsed.violation_type === 'severe';
    const isMild = parsed.violation_type === 'mild';

    return {
      allowed: parsed.allowed,
      shouldWarn: isViolation && isMild && warnCount === 0,
      shouldBlock: isViolation && (isSevere || (isMild && warnCount >= 1)),
      aiReply: parsed.ai_reply || '',
    };
  } catch (err) {
    console.error('Groq error:', err);
    return { allowed: true, shouldWarn: false, shouldBlock: false, aiReply: '' };
  }
};

export const GroupChat: React.FC<{ mode: 'group' | 'destination' }> = ({ mode }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [warnCount, setWarnCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showWarnBanner, setShowWarnBanner] = useState(false);
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

  // ── Helper: save AI message to DB so everyone sees it ────
  const saveAIMessage = useCallback(async (
    text: string,
    checkin: CheckinData
  ) => {
    const payload: Record<string, any> = {
      user_id: 'ai-moderator',
      name: '🤖 MeetDestiny AI',
      profession: 'Safety Moderator',
      text,
      avatar_url: '',
      is_flagged: false,
      is_ai: true,
    };
    if (isGroup) payload.vehicle_id = checkin.vehicle_id;
    else payload.destination = checkin.to_location;

    await supabase.from(tableName).insert(payload);
    // No need to setMessages — realtime broadcasts to all ✅
  }, [isGroup, tableName]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('avatar_url, warn_count, is_banned')
        .eq('user_id', user.id)
        .maybeSingle();

      const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || '';
      setCurrentAvatar(avatar);
      setWarnCount(profile?.warn_count || 0);
      setIsBlocked(profile?.is_banned || false);

      if (profile?.is_banned) {
        toast.error('Your account has been suspended.');
        navigate('/');
        return;
      }

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
        .or('is_flagged.eq.false,is_flagged.is.null')
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

  // ── Realtime with AI moderation on incoming messages ──────
  useEffect(() => {
    if (!currentCheckin) return;
    const chatId = isGroup ? currentCheckin.vehicle_id : currentCheckin.to_location;

    const channel = supabase.channel(`${mode}-chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: tableName,
        filter: `${filterField}=eq.${chatId}`,
      }, async (payload) => {
        console.log('🔥 Realtime fired:', payload);
        const newMsg = payload.new as Message;

        // Skip AI messages — just show them
        if (newMsg.is_ai || newMsg.user_id === 'ai-moderator') {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
          return;
        }

        // Skip flagged messages
        if (newMsg.is_flagged) return;

        // Get current user from auth
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        // ── Own messages — replace optimistic ──
        if (newMsg.user_id === userId) {
          setMessages(prev => {
            if (pendingIds.current.has(newMsg.id)) {
              pendingIds.current.delete(newMsg.id);
              return prev.map(m => m.id === newMsg.id ? { ...newMsg, pending: false } : m);
            }
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
          return;
        }

        // ── Incoming from OTHERS — moderate ──
        if (isGroup) {
          console.log('🤖 Moderating incoming:', newMsg.text);
          const moderation = await moderateMessage(newMsg.text, newMsg.name, 0);

          if (!moderation.allowed) {
            // Flag the original message in DB
            await supabase.from(tableName)
              .update({ is_flagged: true })
              .eq('id', newMsg.id);

            // ✅ Save AI reply to DB — realtime will broadcast to ALL users
            await saveAIMessage(
              moderation.aiReply || '⚠️ A message was removed for violating community guidelines.',
              currentCheckin
            );

            // Warn or ban sender
            if (moderation.shouldBlock) {
              await supabase.from('user_profiles')
                .update({ is_banned: true, warn_count: 2 })
                .eq('user_id', newMsg.user_id);
            } else if (moderation.shouldWarn) {
              try {
                await supabase.rpc('increment_warn_count', {
                  target_user_id: newMsg.user_id,
                });
              } catch {
                await supabase.from('user_profiles')
                  .update({ warn_count: 1, last_warned_at: new Date().toISOString() })
                  .eq('user_id', newMsg.user_id);
              }
            }
            return;
          }
        }

        // ── Message passed — show normally ──
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      })
      .subscribe((status) => {
        console.log('📡 Channel status:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, mode, isGroup, tableName, filterField, scrollToBottom, saveAIMessage]);

  // ── Send with AI moderation (own messages) ────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentCheckin || !currentUserId || sending) return;
    if (isBlocked) {
      toast.error('You have been blocked from this chat.');
      return;
    }

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // Moderate own message before sending (group only)
    if (isGroup) {
      const moderation = await moderateMessage(text, currentCheckin.name, warnCount);

      if (!moderation.allowed) {
        setSending(false);

        // ✅ Save AI reply to DB — realtime broadcasts to everyone
        await saveAIMessage(
          moderation.aiReply || '⚠️ Message removed for violating guidelines.',
          currentCheckin
        );

        if (moderation.shouldWarn) {
          const newWarnCount = warnCount + 1;
          setWarnCount(newWarnCount);
          setShowWarnBanner(true);
          setTimeout(() => setShowWarnBanner(false), 5000);
          await supabase.from('user_profiles')
            .update({ warn_count: newWarnCount, last_warned_at: new Date().toISOString() })
            .eq('user_id', currentUserId);
          toast.warning(`⚠️ Warning ${newWarnCount}/2 — Keep it respectful!`);
        } else if (moderation.shouldBlock) {
          setIsBlocked(true);
          await supabase.from('user_profiles')
            .update({ warn_count: 2, is_banned: true })
            .eq('user_id', currentUserId);
          toast.error('🚫 You have been blocked for repeated violations.');
        }
        return;
      }
    }

    // ── Message passed — send it ──
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      user_id: currentUserId,
      name: currentCheckin.name,
      profession: currentCheckin.profession,
      text,
      avatar_url: currentAvatar,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const payload: Record<string, any> = {
      user_id: currentUserId,
      name: currentCheckin.name,
      profession: currentCheckin.profession,
      text,
      avatar_url: currentAvatar,
      is_flagged: false,
      is_ai: false,
    };
    if (isGroup) payload.vehicle_id = currentCheckin.vehicle_id;
    else payload.destination = currentCheckin.to_location;

    const { data, error } = await supabase.from(tableName).insert(payload).select().single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error('Failed to send message');
      setMessageText(text);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, pending: false } : m));
      pendingIds.current.add(data.id);
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

  // ── Avatar component ──────────────────────────────────────
  const Avatar = ({ name, avatarUrl, size = 32, isAI = false }: {
    name: string; avatarUrl?: string; size?: number; isAI?: boolean;
  }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

    if (isAI) {
      return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
          <ShieldAlert style={{ width: size * 0.5, height: size * 0.5, color: '#fff' }} />
        </div>
      );
    }
    if (avatarUrl && !imgFailed) {
      return (
        <img src={avatarUrl} alt={name} onError={() => setImgFailed(true)}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accentColor}25`, flexShrink: 0 }} />
      );
    }
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${accentGlow}`, flexShrink: 0 }}>
        <span style={{ fontSize: size * 0.34, fontWeight: 700, color: '#fff' }}>{initials}</span>
      </div>
    );
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; msgs: Message[] }[], msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groups.push({ date, msgs: [msg] });
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%' }}>

      {/* ── Header ── */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>{memberCount} members</span>
              {isGroup && (
                <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '1px 6px' }}>
                  🤖 AI Moderated
                </span>
              )}
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.9 }} onClick={toggleMute}
            style={{ width: 36, height: 36, borderRadius: 10, background: isMuted ? 'rgba(148,163,184,0.12)' : `${accentColor}12`, border: `1px solid ${isMuted ? 'rgba(148,163,184,0.2)' : `${accentColor}25`}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMuted ? <BellOff style={{ width: 15, height: 15, color: '#94a3b8' }} /> : <Bell style={{ width: 15, height: 15, color: accentColor }} />}
          </motion.button>
        </div>
      </div>

      {/* ── Warn Banner ── */}
      <AnimatePresence>
        {showWarnBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ flexShrink: 0, background: 'rgba(234,179,8,0.12)', borderBottom: '1px solid rgba(234,179,8,0.3)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert style={{ width: 14, height: 14, color: '#ca8a04', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#854d0e', fontWeight: 500 }}>
              ⚠️ Warning {warnCount}/2 — Keep it respectful or you'll be blocked!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Blocked Banner ── */}
      {isBlocked && (
        <div style={{ flexShrink: 0, background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert style={{ width: 14, height: 14, color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
            🚫 You've been blocked from sending messages in this chat.
          </span>
        </div>
      )}

      {/* ── Messages ── */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.2)' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{group.date}</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.2)' }} />
                </div>

                <AnimatePresence mode="popLayout">
                  {group.msgs.map((message, index) => {
                    const isOwn = message.user_id === currentUserId;
                    const isAIMsg = message.is_ai === true || message.user_id === 'ai-moderator';
                    const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const prevMsg = group.msgs[index - 1];
                    const nextMsg = group.msgs[index + 1];
                    const showHeader = !prevMsg || prevMsg.user_id !== message.user_id;
                    const isLastInGroup = !nextMsg || nextMsg.user_id !== message.user_id;

                    // ── AI system message — centered ──
                    if (isAIMsg) {
                      return (
                        <motion.div key={message.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 16, padding: '10px 14px', maxWidth: '88%' }}>
                            <ShieldAlert style={{ width: 15, height: 15, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', margin: '0 0 3px' }}>MeetDestiny AI</p>
                              <p style={{ fontSize: 13, color: '#dc2626', margin: 0, lineHeight: 1.4 }}>{message.text}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={message.id}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: message.pending ? 0.7 : 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: 8, marginBottom: isLastInGroup ? 10 : 3, alignItems: 'flex-end' }}>

                        {!isOwn && (
                          <div style={{ flexShrink: 0, width: 32, marginBottom: 2 }}>
                            {showHeader
                              ? <Avatar name={message.name} avatarUrl={message.avatar_url} size={32} />
                              : <div style={{ width: 32 }} />
                            }
                          </div>
                        )}

                        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          {!isOwn && showHeader && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{message.name}</span>
                              <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '1px 7px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)' }}>{message.profession}</span>
                            </div>
                          )}

                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                            background: isOwn
                              ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`
                              : 'rgba(255,255,255,0.95)',
                            border: isOwn ? 'none' : '1px solid rgba(148,163,184,0.15)',
                            boxShadow: isOwn ? `0 4px 16px ${accentGlow}` : '0 2px 8px rgba(0,0,0,0.06)',
                          }}>
                            <p style={{ fontSize: 14, color: isOwn ? '#fff' : '#0f172a', margin: 0, lineHeight: 1.55, wordBreak: 'break-word' }}>{message.text}</p>
                          </div>

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

      {/* ── Input ── */}
      <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${accentColor}12` }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar name={currentCheckin?.name || ''} avatarUrl={currentAvatar} size={36} />
          <input
            ref={inputRef}
            type="text"
            placeholder={isBlocked ? '🚫 You are blocked from this chat' : `Message ${chatTitle}...`}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            disabled={isBlocked}
            style={{
              flex: 1, height: 46, borderRadius: 23,
              border: `1.5px solid ${isBlocked ? 'rgba(239,68,68,0.3)' : `${accentColor}25`}`,
              background: isBlocked ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.95)',
              padding: '0 18px', fontSize: 14, color: '#0f172a',
              outline: 'none', fontFamily: 'system-ui, sans-serif',
              transition: 'border-color 0.2s',
              cursor: isBlocked ? 'not-allowed' : 'text',
            }}
            onFocus={e => { if (!isBlocked) e.target.style.borderColor = `${accentColor}60`; }}
            onBlur={e => { if (!isBlocked) e.target.style.borderColor = `${accentColor}25`; }}
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.88 }}
            disabled={!messageText.trim() || sending || isBlocked}
            style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none',
              cursor: messageText.trim() && !isBlocked ? 'pointer' : 'default',
              background: messageText.trim() && !isBlocked
                ? `linear-gradient(135deg, ${accentColor}, ${isGroup ? '#E85A2B' : '#5b21b6'})`
                : 'rgba(148,163,184,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: messageText.trim() && !isBlocked ? `0 4px 16px ${accentGlow}` : 'none',
              transition: 'all 0.2s',
            }}>
            {sending
              ? <Loader2 style={{ width: 16, height: 16, color: '#fff' }} className="animate-spin" />
              : <Send style={{ width: 15, height: 15, color: messageText.trim() && !isBlocked ? '#fff' : '#94a3b8', marginLeft: 1 }} />
            }
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export const VehicleGroupChat: React.FC = () => <GroupChat mode="group" />;
export const DestinationChat: React.FC = () => <GroupChat mode="destination" />;