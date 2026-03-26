import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Wifi, Thermometer, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface LiveVehicleStatusProps {
  vehicleId: string;
}

export const LiveVehicleStatus: React.FC<LiveVehicleStatusProps> = ({ vehicleId }) => {
  const [voted, setVoted] = useState(false);

  // MOCK DATA for prototype
  const [status, setStatus] = useState({
    crowdedness: 'Moderate',
    wifi: 'Fast',
    ac: 'Cooling Well',
    reports: 12
  });

  useEffect(() => {
    // In a real app, fetch from Supabase `vehicle_status` table
    setStatus({
      crowdedness: Math.random() > 0.5 ? 'Moderate' : 'Packed',
      wifi: Math.random() > 0.5 ? 'Fast' : 'Spotty',
      ac: Math.random() > 0.5 ? 'Cooling Well' : 'Too Cold',
      reports: Math.floor(Math.random() * 20) + 1
    });
    setVoted(false);
  }, [vehicleId]);

  const handleVote = (type: string, value: string) => {
    if (voted) {
      toast.error('You already reported status for this vehicle.');
      return;
    }
    setVoted(true);
    setStatus(prev => ({
      ...prev,
      [type]: value,
      reports: prev.reports + 1
    }));
    toast.success('Thanks for reporting! 🙏');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border-2 border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          📡 Live Carriage Status
        </h4>
        <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {status.reports} reports
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
          <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Crowd</p>
          <p className="text-xs font-bold text-gray-800 leading-tight">{status.crowdedness}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
          <Wifi className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">WiFi</p>
          <p className="text-xs font-bold text-gray-800 leading-tight">{status.wifi}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
          <Thermometer className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">AC Temp</p>
          <p className="text-xs font-bold text-gray-800 leading-tight">{status.ac}</p>
        </div>
      </div>

      {!voted ? (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">Report:</span>
          <button onClick={() => handleVote('crowdedness', 'Packed')} className="shrink-0 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100">Crowded</button>
          <button onClick={() => handleVote('wifi', 'No Signal')} className="shrink-0 px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg border border-amber-100">Bad WiFi</button>
          <button onClick={() => handleVote('ac', 'Broken')} className="shrink-0 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100">Hot AC</button>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">Status reported</span>
        </div>
      )}
    </motion.div>
  );
};
