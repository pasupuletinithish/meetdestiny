import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';

export function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] text-slate-800 font-sans p-6">
      <div className="max-w-2xl mx-auto">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-3 py-1.5 rounded-xl border border-white/60 shadow-sm backdrop-blur">
          <ArrowLeft size={16} /> <span className="text-sm font-semibold">Back</span>
        </motion.button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Terms & Conditions</h1>
            <p className="text-sm text-slate-500 font-medium tracking-wide">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-slate-600 bg-white/80 backdrop-blur-xl p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-white">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5 flex items-center gap-2"><span className="text-blue-500">1.</span> Acceptance of Terms</h2>
            <p>By accessing and using MeetDestiny, you accept and agree to be bound by the terms and provision of this agreement. Our platform facilitates in-transit networking among real, verified travelers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5 flex items-center gap-2"><span className="text-blue-500">2.</span> User Conduct</h2>
            <p>You agree to use the platform for lawful purposes and in a way that respects other travelers. Any form of harassment, spam, inappropriate conduct, or abusive language will result in an immediate and permanent ban issued by our moderation team.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5 flex items-center gap-2"><span className="text-blue-500">3.</span> Real-Time Interactions</h2>
            <p>MeetDestiny provides real-time networking during transit. You acknowledge that your presence on a vehicle or route is shared within the context of the journey to fellow co-travelers, ensuring relevant and authentic encounters.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5 flex items-center gap-2"><span className="text-blue-500">4.</span> Ephemeral Nature</h2>
            <p>All private interactions tied to a specific journey are automatically deleted upon the journey's expiration. This mechanism is designed to respect your privacy and mimic the fleeting nature of travel connections.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2.5 flex items-center gap-2"><span className="text-blue-500">5.</span> Disclaimer of Warranties</h2>
            <p>The platform is provided "as is". We make no warranties, expressed or implied, regarding the real-time matching accuracy, vehicle arrival estimates, or the continuous availability of the app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
