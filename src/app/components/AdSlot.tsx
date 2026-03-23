import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface AdSlotProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'standard' | 'mini';
}

export const AdSlot: React.FC<AdSlotProps> = ({ className = '', style, variant = 'standard' }) => {
  if (variant === 'mini') {
    return (
      <div style={style} className={`relative overflow-hidden rounded-lg bg-white/10 border border-white/20 backdrop-blur-md px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-white/20 transition-all ${className}`}>
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-inner shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase font-bold text-white/70 tracking-wider mb-[2px] leading-none">Sponsored</p>
          <p className="text-[11px] font-semibold text-white truncate leading-none">Upgrade to Travel Pro</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border border-indigo-100/60 backdrop-blur-md p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${className}`}
      style={style}
    >
      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-indigo-400 uppercase tracking-widest bg-white/60 backdrop-blur">
        Ad
      </div>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-inner shrink-0 text-white text-2xl">
        🏨
      </div>
      <div className="text-left flex-1 min-w-0 pr-2">
        <h4 className="text-[13px] font-bold text-slate-800 leading-tight mb-0.5 truncate">Premium Stays at 30% Off</h4>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">Relax in luxury lounges around the world. Book your next stay with MeetDestiny.</p>
      </div>
      <button className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors shrink-0">
        Book
      </button>
    </motion.div>
  );
};
