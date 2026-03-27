import { motion } from 'motion/react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] text-slate-800 font-sans p-6">
      <div className="max-w-2xl mx-auto">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-3 py-1.5 rounded-xl border border-white/60 shadow-sm backdrop-blur">
          <ArrowLeft size={16} /> <span className="text-sm font-semibold">Back</span>
        </motion.button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-green-500/20">
            <LockKeyhole size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Privacy Policy</h1>
            <p className="text-sm text-slate-500 font-medium tracking-wide">Your data, safe and sound.</p>
          </div>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-slate-600 bg-white/80 backdrop-blur-xl p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-white">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5">Data Collection</h2>
            <p>We collect basic profile information (Name and Avatar from your Google Account) alongside temporary journey data (Vehicle ID, location) solely to facilitate dynamic networking with co-travelers during active trips.</p>
          </section>

          <section className="bg-green-50/50 border border-green-100 rounded-2xl p-5 -mx-2">
            <h2 className="text-lg font-bold text-green-800 mb-2">Ephemeral Storage Promise</h2>
            <p className="text-green-700/80 leading-relaxed font-medium">To strictly ensure your privacy, <strong>all ephemeral journey data and private chats are automatically purged</strong> from our secure servers as soon as your journey expires or you explicitly check out. What happens on the journey, stays on the journey.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5">Location Data Usage</h2>
            <p>Location data (e.g., GPS coordinates) is strictly utilized during the initial context and verification phases (such as proving you are near the station). It is never broadcasted continuously, stored permanently, or shared overtly with other users.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5">Data Security measures</h2>
            <p>We implement industry-standard security measures provided by Supabase's secure infrastructure to shield your active sessions and stored profile data from unauthorized access or disclosure.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5">Third-Party Services</h2>
            <p>We operate via Google Authentication to manage identities. We do not sell, rent, or trade any personalized data to external marketing companies.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
