import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, Lock, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleGetOtp = async () => {
    if (!email.includes('@')) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setShowOtp(true);
      toast.success('OTP sent! Check your email.');
    }
  };

  const handleLogin = async () => {
    if (otp.length < 8) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'magiclink',
    });
    setLoading(false);
    if (error) {
      toast.error('Invalid OTP. Please try again.');
  
  toast.success('Welcome to Destiny!');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existing } = await supabase
      .from('user_profiles').select('role')
      .eq('user_id', user.id).maybeSingle();

    if (!existing) {
      await supabase.from('user_profiles').insert({
        user_id: user.id, name: '', profession: '',
        total_journeys: 0, role: 'user',
      });
      navigate('/check-in');
    } else if (existing.role?.toLowerCase() === 'admin') {
      navigate('/admin');
    } else {
      // Check active journey
      const { data: activeCheckin } = await supabase
        .from('checkins').select('id')
        .eq('user_id', user.id).eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (activeCheckin) {
        navigate('/discovery');
      } else {
        // Check if has friends (returning user)
        const { count } = await supabase
          .from('friends').select('*', { count: 'exact', head: true })
          .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status', 'accepted');

        if (count && count > 0) {
          navigate('/discovery'); // Returning user — show Start New Journey
        } else {
          navigate('/check-in'); // New user
        }
      }
    }
  } else {
    navigate('/check-in');
  }
}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] overflow-hidden relative">
      <AnimatePresence mode="wait">
        {showAnimation ? (
          <IntroAnimation key="intro" />
        ) : (
          <LoginForm
            key="login"
            email={email}
            setEmail={setEmail}
            otp={otp}
            setOtp={setOtp}
            showOtp={showOtp}
            setShowOtp={setShowOtp}
            handleGetOtp={handleGetOtp}
            handleLogin={handleLogin}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

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
        <motion.div className="absolute bottom-32 left-0 right-0 text-center px-6" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 3.8, ease: 'easeOut' }}>
          <motion.p className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, delay: 4, repeat: Infinity, ease: 'easeInOut' }}>
            Your paths were meant to meet.
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

function LoginForm({
  email, setEmail, otp, setOtp, showOtp, setShowOtp, handleGetOtp, handleLogin, loading,
}: {
  email: string;
  setEmail: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  showOtp: boolean;
  setShowOtp: (value: boolean) => void;
  handleGetOtp: () => void;
  handleLogin: () => void;
  loading: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-64 h-64 rounded-full bg-[#1E88E5]/10 blur-3xl" animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} style={{ top: '10%', left: '10%' }} />
        <motion.div className="absolute w-96 h-96 rounded-full bg-[#FF6B35]/10 blur-3xl" animate={{ x: [0, -80, 0], y: [0, 80, 0], scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} style={{ bottom: '10%', right: '10%' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="text-center mb-12">
          <motion.div className="inline-flex items-center gap-2 mb-4" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}>
            <Sparkles className="w-8 h-8 text-[#1E88E5]" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent">Destiny</h1>
            <Sparkles className="w-8 h-8 text-[#FF6B35]" />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="text-gray-600 text-sm">Connect. Travel. Together.</motion.p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }} className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20" style={{ boxShadow: '0 20px 60px rgba(30, 136, 229, 0.15), 0 8px 24px rgba(255, 107, 53, 0.1)' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
              <h2 className="text-2xl font-semibold text-center mb-2 bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent">Welcome Traveler</h2>
              <p className="text-gray-600 text-center text-sm mb-8">Your journey begins here</p>

              <div className="space-y-4">
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E88E5]" />
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-14 rounded-2xl border-2 border-gray-200 focus:border-[#1E88E5] transition-all duration-300"
                      disabled={showOtp || loading}
                    />
                  </div>
                </motion.div>

                {showOtp && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.5 }}>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FF6B35]" />
                      <Input
                        type="text"
                        placeholder="Enter 8-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="pl-12 h-14 rounded-2xl border-2 border-gray-200 focus:border-[#FF6B35] transition-all duration-300"
                        maxLength={8}
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      OTP sent to <span className="font-medium text-[#1E88E5]">{email}</span>
                    </p>
                  </motion.div>
                )}

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}>
                  {!showOtp ? (
                    <Button
                      onClick={handleGetOtp}
                      disabled={!email.includes('@') || loading}
                      className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] hover:from-[#1565C0] hover:to-[#0D47A1] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sending OTP...' : 'Get OTP'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLogin}
                      disabled={otp.length < 8 || loading}
                      className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E85A2B] hover:from-[#E85A2B] hover:to-[#D94E1F] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Verifying...' : 'Login'}
                    </Button>
                  )}
                </motion.div>

                {showOtp && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    onClick={() => { setShowOtp(false); setOtp(''); }}
                    className="w-full text-center text-sm text-[#1E88E5] hover:text-[#1565C0] transition-colors duration-200"
                    disabled={loading}
                  >
                    Change email address
                  </motion.button>
                )}
              </div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }} className="text-xs text-gray-500 text-center mt-8">
                By continuing, you agree to Destiny's{' '}
                <span className="text-[#1E88E5] hover:underline cursor-pointer">Terms of Service</span>{' '}
                and{' '}
                <span className="text-[#1E88E5] hover:underline cursor-pointer">Privacy Policy</span>
              </motion.p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }} className="mt-12 text-center">
          <p className="text-gray-600 text-sm">Where every journey creates a connection</p>
        </motion.div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-20 h-20 rounded-2xl"
            style={{ background: i % 2 === 0 ? 'linear-gradient(135deg, rgba(30, 136, 229, 0.1), rgba(30, 136, 229, 0.05))' : 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(255, 107, 53, 0.05))', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, backdropFilter: 'blur(10px)' }}
            animate={{ y: [0, -30, 0], rotateX: [0, 360], rotateY: [0, 360], scale: [1, 1.1, 1] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}