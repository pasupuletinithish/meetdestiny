import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const [showAnimation, setShowAnimation] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAnimation(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await handlePostLogin(session.user);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handlePostLogin = async (user: any) => {
    const { data: existing } = await supabase
      .from('user_profiles').select('role')
      .eq('user_id', user.id).maybeSingle();

    if (!existing) {
      await supabase.from('user_profiles').insert({
        user_id: user.id,
        name: user.user_metadata?.full_name || '',
        profession: '',
        total_journeys: 0,
        role: 'user',
      });
      navigate('/check-in');
    } else if (existing.role?.toLowerCase() === 'admin') {
      navigate('/admin');
    } else {
      const { data: activeCheckin } = await supabase
        .from('checkins').select('id')
        .eq('user_id', user.id).eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (activeCheckin) {
        navigate('/discovery');
      } else {
        const { count } = await supabase
          .from('friends').select('*', { count: 'exact', head: true })
          .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status', 'accepted');

        navigate(count && count > 0 ? '/discovery' : '/check-in');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] overflow-hidden relative">
      <AnimatePresence mode="wait">
        {showAnimation ? (
          <IntroAnimation key="intro" />
        ) : (
          <LoginForm key="login" handleGoogleLogin={handleGoogleLogin} loading={loading} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compass Logo ──────────────────────────────────────────────
function CompassLogo() {
  return (
    <svg width="160" height="160" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pp1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7F77DD"/>
          <stop offset="100%" stopColor="#D4537E"/>
        </linearGradient>
        <linearGradient id="pp2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#534AB7"/>
          <stop offset="100%" stopColor="#993556"/>
        </linearGradient>
        <linearGradient id="pp3" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#993556"/>
          <stop offset="100%" stopColor="#D4537E"/>
        </linearGradient>
        <linearGradient id="pp4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#AFA9EC"/>
          <stop offset="100%" stopColor="#ED93B1"/>
        </linearGradient>
      </defs>
      <g transform="translate(200,200)">
        <circle cx="0" cy="0" r="148" fill="none" stroke="url(#pp1)" strokeWidth="0.5" opacity="0.12"/>
        <circle cx="0" cy="0" r="132" fill="none" stroke="url(#pp1)" strokeWidth="0.8" opacity="0.18"/>
        <circle cx="0" cy="0" r="116" fill="none" stroke="url(#pp2)" strokeWidth="1" opacity="0.25"/>
        <g stroke="url(#pp1)" strokeLinecap="round" opacity="0.5" strokeWidth="1.5">
          <line x1="0" y1="-116" x2="0" y2="-100"/>
          <line x1="0" y1="100" x2="0" y2="116"/>
          <line x1="-116" y1="0" x2="-100" y2="0"/>
          <line x1="100" y1="0" x2="116" y2="0"/>
          <line x1="82" y1="-82" x2="71" y2="-71"/>
          <line x1="-82" y1="-82" x2="-71" y2="-71"/>
          <line x1="82" y1="82" x2="71" y2="71"/>
          <line x1="-82" y1="82" x2="-71" y2="71"/>
        </g>
        <circle cx="0" cy="0" r="96" fill="none" stroke="url(#pp2)" strokeWidth="1.8" opacity="0.6"/>
        <text fontFamily="sans-serif" fontSize="15" fontWeight="600" fill="url(#pp3)" x="0" y="-104" textAnchor="middle" dominantBaseline="central">N</text>
        <text fontFamily="sans-serif" fontSize="11" fill="#9c9a92" x="0" y="112" textAnchor="middle" dominantBaseline="central">S</text>
        <text fontFamily="sans-serif" fontSize="11" fill="#9c9a92" x="112" y="0" textAnchor="middle" dominantBaseline="central">E</text>
        <text fontFamily="sans-serif" fontSize="11" fill="#9c9a92" x="-112" y="0" textAnchor="middle" dominantBaseline="central">W</text>
        <path d="M0 -92 L11 0 L0 16 L-11 0Z" fill="url(#pp3)"/>
        <path d="M0 92 L6 0 L0 -16 L-6 0Z" fill="url(#pp4)" opacity="0.3"/>
        <circle cx="0" cy="0" r="40" fill="url(#pp1)" opacity="0.06"/>
        <circle cx="0" cy="0" r="36" fill="white" stroke="url(#pp2)" strokeWidth="2"/>
        <circle cx="0" cy="0" r="28" fill="none" stroke="url(#pp1)" strokeWidth="0.5" opacity="0.3"/>
        <circle cx="-10" cy="-11" r="8" fill="#534AB7"/>
        <path d="M-20 4 Q-10 14 0 4" fill="#534AB7"/>
        <circle cx="10" cy="-11" r="8" fill="#D4537E"/>
        <path d="M0 4 Q10 14 20 4" fill="#D4537E"/>
        <circle cx="0" cy="-4" r="3.5" fill="white" opacity="0.9"/>
        <circle cx="0" cy="-96" r="5" fill="url(#pp3)"/>
        <circle cx="68" cy="-68" r="3.5" fill="url(#pp1)" opacity="0.7"/>
        <circle cx="96" cy="0" r="3" fill="url(#pp1)" opacity="0.5"/>
      </g>
    </svg>
  );
}

// ── Intro Animation ───────────────────────────────────────────
function IntroAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0]"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#1E88E5]/5 to-[#FF6B35]/5"
        animate={{
          background: [
            'linear-gradient(to bottom right, rgba(30, 136, 229, 0.05), rgba(255, 107, 53, 0.05))',
            'linear-gradient(to bottom right, rgba(255, 107, 53, 0.05), rgba(30, 136, 229, 0.05))',
            'linear-gradient(to bottom right, rgba(30, 136, 229, 0.05), rgba(255, 107, 53, 0.05))',
          ],
        }}
        transition={{ duration: 5, ease: 'easeInOut' }}
      />
      <div className="relative w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 800 600" className="w-full h-full max-w-4xl" preserveAspectRatio="xMidYMid meet">
          <motion.path d="M 100 500 Q 200 400, 400 300" stroke="#1E88E5" strokeWidth="3" fill="none" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
          <motion.path d="M 700 100 Q 600 200, 400 300" stroke="#FF6B35" strokeWidth="3" fill="none" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
          <motion.g initial={{ x: 100, y: 500, opacity: 0 }} animate={{ x: 400, y: 300, opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 3.5, delay: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}>
            <circle cx="0" cy="0" r="20" fill="#1E88E5" />
            <circle cx="0" cy="-25" r="12" fill="#1E88E5" />
            <rect x="-8" y="15" width="16" height="12" rx="2" fill="#1565C0" />
            <motion.circle cx="0" cy="0" r="25" fill="none" stroke="#1E88E5" strokeWidth="2" opacity="0.4" animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 1.5, repeat: 2, ease: 'easeOut' }} />
          </motion.g>
          <motion.g initial={{ x: 700, y: 100, opacity: 0 }} animate={{ x: 400, y: 300, opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 3.5, delay: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}>
            <circle cx="0" cy="0" r="20" fill="#FF6B35" />
            <circle cx="0" cy="-25" r="12" fill="#FF6B35" />
            <rect x="-10" y="-15" width="20" height="15" rx="3" fill="#E85A2B" />
            <motion.circle cx="0" cy="0" r="25" fill="none" stroke="#FF6B35" strokeWidth="2" opacity="0.4" animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 1.5, repeat: 2, ease: 'easeOut' }} />
          </motion.g>
          <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 1] }} transition={{ duration: 0.8, delay: 3.5, ease: 'easeOut' }}>
            <circle cx="400" cy="300" r="30" fill="url(#burstGradient)" opacity="0.3" />
            <motion.circle cx="400" cy="300" r="20" fill="none" stroke="url(#logoGradient)" strokeWidth="3" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, delay: 4, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.text x="400" y="300" textAnchor="middle" dominantBaseline="middle" fontSize="48" fill="url(#logoGradient)" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 4, ease: 'backOut' }}>Destiny</motion.text>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = 400 + Math.cos(rad) * 60;
              const y = 300 + Math.sin(rad) * 60;
              return <motion.circle key={i} cx={x} cy={y} r="4" fill={i % 2 === 0 ? '#1E88E5' : '#FF6B35'} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 4 + i * 0.1, ease: 'easeOut' }} />;
            })}
          </motion.g>
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E88E5" />
              <stop offset="100%" stopColor="#FF6B35" />
            </linearGradient>
            <radialGradient id="burstGradient">
              <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
        <motion.div className="absolute bottom-16 left-0 right-0 text-center px-6" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 3.8, ease: 'easeOut' }}>
          <motion.p className="text-xl md:text-3xl font-semibold bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, delay: 4, repeat: Infinity, ease: 'easeInOut' }}>
            Your paths were meant to meet.
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Login Form (Mobile First) ─────────────────────────────────
// ── Premium LoginForm (Static + Motion Graphics) ────────────────
function LoginForm({
  handleGoogleLogin,
  loading,
}: {
  handleGoogleLogin: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center font-sans overflow-hidden bg-slate-50/80"
    >
      {/* 1. Dynamic Aurora Mesh Background - Optimized for 60FPS (No heavy blurs) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-[#f4f7fc]">
        <motion.div
          className="absolute rounded-full opacity-60"
          style={{ width: '80vw', height: '80vw', top: '-20%', left: '-10%', background: 'radial-gradient(circle, rgba(30,136,229,0.15) 0%, rgba(30,136,229,0) 60%)' }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full opacity-50"
          style={{ width: '70vw', height: '70vw', bottom: '-10%', right: '-10%', background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, rgba(255,107,53,0) 60%)' }}
          animate={{ x: [0, -40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full opacity-50"
          style={{ width: '90vw', height: '90vw', top: '10%', left: '20%', background: 'radial-gradient(circle, rgba(83,74,183,0.1) 0%, rgba(83,74,183,0) 60%)' }}
          animate={{ x: [0, -30, 40, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* 2. Realistic 3D Travel Network (High Performance SVG animateMotion) */}
      <svg className="absolute inset-0 w-full h-full z-0 opacity-60 pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E88E5" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#534AB7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FF6B35" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="pathGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#D4537E" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1E88E5" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        {/* Hub Connection Lines (Triangle Network) */}
        <path d="M 450 200 L 650 500 L 350 800 Z" fill="none" stroke="url(#pathGrad)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />

        {/* Animated Background Paths intersecting exactly at Hubs */}
        {/* Train Route: Top-Left to Bottom-Right */}
        <path id="route-train" d="M 150 -100 C 250 0, 350 100, 450 200 S 550 400, 650 500 S 850 800, 950 1100" fill="none" stroke="url(#pathGrad)" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />
        
        {/* Bus Route: Top-Right to Bottom-Left */}
        <path id="route-bus" d="M 850 -100 C 750 100, 700 350, 650 500 S 450 650, 350 800 S 150 1000, 50 1100" fill="none" stroke="url(#pathGrad2)" strokeWidth="1.5" strokeDasharray="8 8" opacity="0.8" />
        
        {/* Human Route: Bottom-Left to Top-Right sweeping through West */}
        <path id="route-human" d="M 150 1100 C 250 1000, 300 900, 350 800 S 300 300, 450 200 S 650 0, 750 -100" fill="none" stroke="url(#pathGrad)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

        {/* Major City Hubs (Glowing Nodes) */}
        {/* Hub 1 (North) */}
        <circle cx="450" cy="200" r="6" fill="#1E88E5" />
        <motion.circle cx="450" cy="200" r="24" fill="none" stroke="#1E88E5" strokeWidth="2" animate={{ scale: [1, 1.8], opacity: [0.6, 0] }} transition={{ duration: 3, repeat: Infinity }} />
        
        {/* Hub 2 (Center East) */}
        <circle cx="650" cy="500" r="8" fill="#534AB7" />
        <motion.circle cx="650" cy="500" r="30" fill="none" stroke="#534AB7" strokeWidth="2" animate={{ scale: [1, 2], opacity: [0.5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} />
        
        {/* Hub 3 (South) */}
        <circle cx="350" cy="800" r="5" fill="#D4537E" />
        <motion.circle cx="350" cy="800" r="20" fill="none" stroke="#D4537E" strokeWidth="1" animate={{ scale: [1, 1.5], opacity: [0.8, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />

        {/* 3D Realistic Assets traversing the structured routes */}
        
        {/* Premium Top-Down Train Vector */}
        <g>
          <animateMotion dur="25s" repeatCount="indefinite" rotate="auto">
            <mpath href="#route-train"/>
          </animateMotion>
          <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#1E88E5" opacity="0.3" filter="blur(4px)" />
          <rect x="-20" y="-6" width="40" height="12" rx="6" fill="#1E88E5" />
          <path d="M 10 -4 L 16 -2 L 16 2 L 10 4 Z" fill="#ffffff" />
          <rect x="-14" y="-2" width="20" height="4" rx="2" fill="#ffffff" opacity="0.4" />
        </g>

        {/* Premium Top-Down Bus Vector */}
        <g>
          <animateMotion dur="35s" repeatCount="indefinite" rotate="auto">
            <mpath href="#route-bus"/>
          </animateMotion>
          <rect x="-20" y="-10" width="40" height="20" rx="6" fill="#FF6B35" opacity="0.3" filter="blur(4px)" />
          <rect x="-16" y="-8" width="32" height="16" rx="4" fill="#FF6B35" />
          <rect x="10" y="-6" width="4" height="12" rx="1.5" fill="#ffffff" />
          <rect x="-12" y="-5" width="18" height="10" rx="2" fill="#000000" opacity="0.1" />
        </g>

        {/* Premium Top-Down Traveler Vector */}
        <g>
          <animateMotion dur="45s" repeatCount="indefinite" rotate="auto">
            <mpath href="#route-human"/>
          </animateMotion>
          <circle cx="0" cy="0" r="14" fill="#534AB7" opacity="0.3" filter="blur(3px)" />
          <rect x="-6" y="-7" width="10" height="14" rx="5" fill="#534AB7" />
          <circle cx="2" cy="0" r="5" fill="#ffffff" />
        </g>
      </svg>

      {/* 3. Central Login Container */}
      <div className="relative z-10 w-full max-w-sm md:max-w-md px-6 flex flex-col items-center">
        
        {/* Logo & Headline */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="text-center mb-8 w-full"
        >
          <motion.div 
            className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6 relative"
            whileHover={{ rotate: 10, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[#1E88E5]/20 to-[#FF6B35]/20 rounded-2xl blur-md" />
            <CompassLogo />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-3 flex items-center justify-center gap-2">
            Meet<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#D4537E]">Destiny</span>
          </h1>
          <p className="text-slate-500 font-medium tracking-wide">Meet someone at every mile.</p>
        </motion.div>

        {/* Premium Glassmorphic Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className="w-full relative group"
        >
          {/* Card subtle glowing outline ring */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-white/80 to-white/20 rounded-[2rem] blur-[2px] pointer-events-none" />
          
          <div className="relative bg-white/60 backdrop-blur-2xl px-8 py-10 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white/50 w-full overflow-hidden">
            {/* Inner top shine */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-xl font-bold text-slate-800 mb-1">Welcome aboard 👋</h2>
              <p className="text-slate-500 text-sm mb-8 text-center">Join thousands of travelers networking on the move.</p>

              {/* Call to Action Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                <Button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-14 rounded-xl relative overflow-hidden bg-white text-slate-700 font-bold shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] border border-slate-200/60 transition-all flex items-center justify-center gap-3 text-base group/btn"
                >
                  {/* Button background morph */}
                  <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  
                  {loading ? (
                    <span className="relative z-10 flex items-center gap-2 text-blue-600">
                      <motion.div
                        className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Syncing...
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center gap-3">
                      <svg width="22" height="22" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </span>
                  )}
                </Button>
              </motion.div>

              {/* Trust Indicators */}
              <div className="w-full flex justify-between items-center mt-8 px-2">
                {['Verified Profiles', 'Real-time Radar', 'Free forever'].map((perk, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      {i === 0 && <ShieldCheck size={14} />}
                      {i === 1 && <Sparkles size={14} />}
                      {i === 2 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center max-w-[50px] leading-tight">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="text-center text-xs text-slate-400 mt-8"
        >
          By continuing, you agree to our <a href="/terms" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">Terms</a> & <a href="/privacy" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">Privacy</a>
        </motion.p>
      </div>
    </motion.div>
  );
}