import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, Medal, Star, Map, Gamepad2, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'travel' | 'games'>('travel');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // MOCK DATA for Prototype
  const topTravelers = [
    { id: '1', name: 'Alex M.', avatar: null, score: 12450, unit: 'miles', badge: 'Diamond Voyager' },
    { id: '2', name: 'Sarah K.', avatar: null, score: 9800, unit: 'miles', badge: 'Platinum Explorer' },
    { id: '3', name: 'David R.', avatar: null, score: 8400, unit: 'miles', badge: 'Gold Trekker' },
    { id: 'curr', name: 'You', avatar: null, score: 1200, unit: 'miles', badge: 'Bronze Beginner', isMe: true },
  ];

  const topGamers = [
    { id: '1', name: 'NinjaTrek', avatar: null, game: 'Destiny Dash', score: '24 Wins', badge: 'Grandmaster' },
    { id: '2', name: 'ElenaG', avatar: null, game: 'Tic Tac Toe', score: '50 Wins', badge: 'Strategist' },
    { id: '3', name: 'Marcus', avatar: null, game: 'Co-Op Escape', score: '12 Escapes', badge: 'Team Player' },
    { id: 'curr', name: 'You', avatar: null, game: 'Destiny Heights', score: '3 Wins', badge: 'Rookie', isMe: true },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('name, avatar_url').eq('user_id', user.id).single();
        setCurrentUser({ id: user.id, ...profile });
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  return (
    <div style={{ height: '100dvh', background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', overflowX: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '20px 20px 10px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} color="#475569" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              Hall of Fame <Trophy size={20} color="#eab308" />
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setActiveTab('travel')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: activeTab === 'travel' ? '#fff' : 'transparent', color: activeTab === 'travel' ? '#3b82f6' : '#64748b', fontWeight: 800, fontSize: 14, boxShadow: activeTab === 'travel' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Map size={16} /> Travelers
          </button>
          <button onClick={() => setActiveTab('games')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: activeTab === 'games' ? '#fff' : 'transparent', color: activeTab === 'games' ? '#8b5cf6' : '#64748b', fontWeight: 800, fontSize: 14, boxShadow: activeTab === 'games' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Gamepad2 size={16} /> Gaming
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(activeTab === 'travel' ? topTravelers : topGamers).map((item, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;
            const rankColor = isFirst ? '#f59e0b' : isSecond ? '#94a3b8' : isThird ? '#b45309' : '#e2e8f0';
            
            return (
               <motion.div 
                 key={item.id}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: index * 0.1 }}
                 style={{ 
                   background: item.isMe ? '#eff6ff' : '#fff', 
                   border: `2px solid ${item.isMe ? '#bfdbfe' : 'transparent'}`,
                   padding: 16, borderRadius: 20, 
                   boxShadow: isFirst ? '0 8px 30px rgba(245,158,11,0.15)' : '0 4px 12px rgba(0,0,0,0.02)',
                   display: 'flex', alignItems: 'center', gap: 16,
                   position: 'relative', overflow: 'hidden'
                 }}
               >
                 {isFirst && <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), transparent)', borderBottomLeftRadius: 60 }} />}
                 
                 <div style={{ width: 32, height: 32, borderRadius: '50%', background: rankColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isFirst || isSecond || isThird ? '#fff' : '#64748b', fontWeight: 900, fontSize: 14 }}>
                   {index < 3 ? index + 1 : index + 1}
                 </div>

                 <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                     {item.isMe ? currentUser?.name || 'You' : item.name} {item.isMe && <span style={{fontSize: 12, color: '#3b82f6', fontWeight: 700}}>(You)</span>}
                   </p>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                     <Award size={14} color={activeTab === 'travel' ? '#10b981' : '#8b5cf6'} />
                     <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{item.badge}</span>
                   </div>
                   {'game' in item && <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', fontWeight: 600 }}>Dominating: {item.game}</p>}
                 </div>

                 <div style={{ textAlign: 'right' }}>
                   <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: activeTab === 'travel' ? '#3b82f6' : '#8b5cf6' }}>
                     {item.score}
                   </p>
                   {'unit' in item && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{item.unit}</p>}
                 </div>
               </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
