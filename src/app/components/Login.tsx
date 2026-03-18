import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Sparkles } from 'lucide-react';
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
      className="absolute inset-0 flex flex-col"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full bg-[#1E88E5]/10 blur-3xl"
          animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ top: '5%', left: '5%' }}
        />
        <motion.div
          className="absolute w-64 h-64 md:w-96 md:h-96 rounded-full bg-[#FF6B35]/10 blur-3xl"
          animate={{ x: [0, -60, 0], y: [0, 60, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{ bottom: '5%', right: '5%' }}
        />
      </div>

      {/* Top illustration area */}
      <div className="relative flex-1 flex items-center justify-center pt-16 pb-4 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center"
        >
          {/* Compass Logo */}
          <motion.div
            className="flex justify-center mb-4"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CompassLogo />
          </motion.div>

          {/* App name */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[#534AB7]" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#534AB7] to-[#D4537E] bg-clip-text text-transparent">
                MeetDestiny
              </h1>
              <Sparkles className="w-5 h-5 text-[#D4537E]" />
            </div>
            <p className="text-gray-500 text-sm tracking-wide">
              Meet someone at every mile
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex justify-center gap-2 mt-5 flex-wrap"
          >
            {['🚆 Train', '🚌 Bus', '👥 Connect'].map((tag, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-white/70 backdrop-blur text-xs font-medium text-gray-600 border border-white/40 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom card */}
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full px-4 pb-8 pt-2"
      >
        <div
          className="bg-white/90 backdrop-blur-xl rounded-3xl px-6 py-8 shadow-2xl border border-white/30 w-full max-w-sm mx-auto md:max-w-md"
          style={{ boxShadow: '0 -4px 40px rgba(83, 74, 183, 0.12), 0 20px 60px rgba(212, 83, 126, 0.1)' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <h2 className="text-xl font-semibold text-center mb-1 text-gray-800">
              Welcome, Traveler 👋
            </h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              Your journey begins here
            </p>

            {/* Google Button */}
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-white hover:bg-gray-50 text-gray-700 font-medium shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    className="w-5 h-5 border-2 border-gray-300 border-t-[#534AB7] rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Connecting...
                </span>
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">safe & secure</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Trust badges */}
            <div className="flex justify-center gap-4 mb-5">
              {['🔒 Private', '✨ Free', '🚀 Instant'].map((badge, i) => (
                <span key={i} className="text-xs text-gray-500 font-medium">{badge}</span>
              ))}
            </div>

            {/* Terms */}
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              By continuing, you agree to our{' '}
              <span className="text-[#534AB7] hover:underline cursor-pointer">Terms</span>
              {' & '}
              <span className="text-[#534AB7] hover:underline cursor-pointer">Privacy Policy</span>
            </p>
          </motion.div>
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-center text-xs text-gray-400 mt-4"
        >
          Where every journey creates a connection
        </motion.p>
      </motion.div>
    </motion.div>
  );
}