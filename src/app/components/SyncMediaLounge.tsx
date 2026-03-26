import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Play, Pause, Users, Radio, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useWindowSize } from 'react-use';

export const SyncMediaLounge: React.FC = () => {
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentCheckin, setCurrentCheckin] = useState<any>(null);
  const [viewers, setViewers] = useState<any[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const isHost = useRef(false);
  const isProgrammaticEvent = useRef(false);

  // Use a reliable sample video
  const videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: profile } = await supabase.from('user_profiles').select('name, avatar_url').eq('user_id', user.id).single();
      setCurrentUser({ id: user.id, name: profile?.name || 'Traveler', avatar_url: profile?.avatar_url });

      const { data: checkin } = await supabase
        .from('checkins').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!checkin) { navigate('/check-in'); return; }
      setCurrentCheckin(checkin);

      // Fetch other viewers
      const fetchViewers = async () => {
        const { data: tvlrs } = await supabase
          .from('checkins').select('user_id, name, avatar_url')
          .eq('vehicle_id', checkin.vehicle_id)
          .eq('is_active', true)
          .neq('user_id', user.id);
        setViewers(tvlrs || []);
      };
      
      await fetchViewers();

      // Setup Realtime Sync
      const channel = supabase.channel(`media-${checkin.vehicle_id}`, {
        config: { broadcast: { self: false } }
      });

      channel
        .on('broadcast', { event: 'media_state' }, (payload) => {
          const { action, time, senderId } = payload.payload;
          if (senderId === user.id) return; // ignore own echoes

          const video = videoRef.current;
          if (!video) return;

          isProgrammaticEvent.current = true;
          
          if (action === 'play') {
            if (Math.abs(video.currentTime - time) > 1) {
              video.currentTime = time;
            }
            video.play().catch(e => console.log('Autoplay prevented:', e));
          } else if (action === 'pause') {
            video.pause();
            video.currentTime = time;
          } else if (action === 'seek') {
            video.currentTime = time;
          }

          setTimeout(() => { isProgrammaticEvent.current = false; }, 100);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setLoading(false);
            toast.success("Joined Watch Party!");
          }
        });

      channelRef.current = channel;
    };
    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [navigate]);

  const broadcastState = (action: 'play' | 'pause' | 'seek') => {
    if (isProgrammaticEvent.current || !channelRef.current || !videoRef.current || !currentUser) return;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'media_state',
      payload: { 
        action, 
        time: videoRef.current.currentTime,
        senderId: currentUser.id 
      }
    });

    if (action === 'play') toast.success(`${currentUser.name} played the video`);
    if (action === 'pause') toast(`${currentUser.name} paused the video`);
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)' }}>
        <Loader2 className="animate-spin" style={{ color: '#ec4899' }} size={32} />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', background: 'linear-gradient(160deg, #111827 0%, #000000 100%)', display: 'flex', flexDirection: 'column', color: '#fff' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff' }}>Sync Watch Party</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Vehicle: {currentCheckin?.vehicle_id}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(236,72,153,0.2)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(236,72,153,0.3)' }}>
            <Radio size={14} color="#ec4899" className="animate-pulse" />
            <span style={{ fontSize: 12, color: '#fbcfe8', fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        
        {/* Video Player */}
        <div style={{ width: '100%', background: '#000', position: 'relative', boxShadow: '0 8px 30px rgba(236,72,153,0.15)' }}>
          <video 
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            style={{ width: '100%', maxHeight: '40vh', objectFit: 'contain' }}
            onPlay={() => broadcastState('play')}
            onPause={() => broadcastState('pause')}
            onSeeked={() => broadcastState('seek')}
          />
        </div>

        {/* Info & Viewers Section */}
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Big Buck Bunny (Short Film)
          </h2>
          <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
            Everyone in the vehicle Lounge is synced to this player. If anyone pauses, it pauses for everyone. Grab some snacks and enjoy!
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#ec4899" /> Current Viewers
              </h3>
              <span style={{ fontSize: 12, background: 'rgba(236,72,153,0.2)', color: '#fbcfe8', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                {viewers.length + 1} Watching
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Self */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', padding: 2 }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {currentUser?.avatar_url ? <img src={currentUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{fontSize: 14, color: '#fff'}}>{currentUser?.name?.[0]}</span>}
                  </div>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#f3f4f6', fontSize: 15 }}>{currentUser?.name} <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>(You)</span></p>
                </div>
              </div>

              {/* Others */}
              {viewers.map((viewer) => (
                <div key={viewer.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {viewer.avatar_url ? <img src={viewer.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{fontSize: 14, color: '#fff'}}>{viewer.name?.[0]}</span>}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#d1d5db', fontSize: 15 }}>{viewer.name}</p>
                  </div>
                </div>
              ))}

              {viewers.length === 0 && (
                <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', margin: '16px 0', fontStyle: 'italic' }}>
                  No one else is here yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
