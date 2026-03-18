import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { MapPin, Briefcase, Bus, Train, Search, Loader2, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type TabType = 'reserved-train' | 'reserved-bus' | 'route-match';

// ── Compass Logo (inline, no 404) ─────────────────────────────
function CompassLogo() {
  return (
    <svg width="56" height="56" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cl1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7F77DD"/>
          <stop offset="100%" stopColor="#D4537E"/>
        </linearGradient>
        <linearGradient id="cl2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#534AB7"/>
          <stop offset="100%" stopColor="#993556"/>
        </linearGradient>
        <linearGradient id="cl3" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#993556"/>
          <stop offset="100%" stopColor="#D4537E"/>
        </linearGradient>
        <linearGradient id="cl4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#AFA9EC"/>
          <stop offset="100%" stopColor="#ED93B1"/>
        </linearGradient>
      </defs>
      <g transform="translate(200,200)">
        <circle cx="0" cy="0" r="148" fill="none" stroke="url(#cl1)" strokeWidth="0.5" opacity="0.12"/>
        <circle cx="0" cy="0" r="116" fill="none" stroke="url(#cl2)" strokeWidth="1" opacity="0.25"/>
        <g stroke="url(#cl1)" strokeLinecap="round" opacity="0.5" strokeWidth="1.5">
          <line x1="0" y1="-116" x2="0" y2="-100"/>
          <line x1="0" y1="100" x2="0" y2="116"/>
          <line x1="-116" y1="0" x2="-100" y2="0"/>
          <line x1="100" y1="0" x2="116" y2="0"/>
        </g>
        <circle cx="0" cy="0" r="96" fill="none" stroke="url(#cl2)" strokeWidth="1.8" opacity="0.6"/>
        <text fontFamily="sans-serif" fontSize="15" fontWeight="600" fill="url(#cl3)" x="0" y="-104" textAnchor="middle" dominantBaseline="central">N</text>
        <path d="M0 -92 L11 0 L0 16 L-11 0Z" fill="url(#cl3)"/>
        <path d="M0 92 L6 0 L0 -16 L-6 0Z" fill="url(#cl4)" opacity="0.3"/>
        <circle cx="0" cy="0" r="36" fill="white" stroke="url(#cl2)" strokeWidth="2"/>
        <circle cx="-10" cy="-11" r="8" fill="#534AB7"/>
        <path d="M-20 4 Q-10 14 0 4" fill="#534AB7"/>
        <circle cx="10" cy="-11" r="8" fill="#D4537E"/>
        <path d="M0 4 Q10 14 20 4" fill="#D4537E"/>
        <circle cx="0" cy="-4" r="3.5" fill="white" opacity="0.9"/>
      </g>
    </svg>
  );
}

export const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('reserved-train');
  const [loading, setLoading] = useState(false);
  const [fetchingVehicle, setFetchingVehicle] = useState(false);
  const [userName, setUserName] = useState('');
  const [profession, setProfession] = useState('');

  // Train
  const [pnr, setPnr] = useState('');
  const [pnrData, setPnrData] = useState<any>(null);

  // Bus
  const [busIdInput, setBusIdInput] = useState('');
  const [busData, setBusData] = useState<any>(null);
  const [busNotFound, setBusNotFound] = useState(false);
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualArrival, setManualArrival] = useState('');
  const [manualOperator, setManualOperator] = useState('');

  // Route Match
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeArrival, setRouteArrival] = useState('');
  const [routeMatches, setRouteMatches] = useState<number>(0);
  const [checkedRoute, setCheckedRoute] = useState(false);

  // Auto-fetch name from Google
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }
    };
    fetchUser();
  }, []);

  const calculateExpiry = (arrivalTime: string, journeyDate?: string) => {
    const now = new Date();
    let hours = 0, minutes = 0;
    if (arrivalTime.includes('AM') || arrivalTime.includes('PM')) {
      const [time, modifier] = arrivalTime.split(' ');
      const [h, m] = time.split(':').map(Number);
      hours = modifier === 'PM' && h !== 12 ? h + 12 : modifier === 'AM' && h === 12 ? 0 : h;
      minutes = m;
    } else {
      const [h, m] = arrivalTime.split(':').map(Number);
      hours = h; minutes = m;
    }
    const arrival = journeyDate ? new Date(journeyDate) : new Date();
    arrival.setHours(hours, minutes, 0, 0);
    if (arrival <= now && !journeyDate) arrival.setDate(arrival.getDate() + 1);
    arrival.setMinutes(arrival.getMinutes() + 30);
    return arrival.toISOString();
  };

  const fetchPNR = async () => {
    if (pnr.length < 10) { toast.error('Please enter a valid 10-digit PNR'); return; }
    setFetchingVehicle(true);
    try {
      const response = await fetch(
        `https://irctc-indian-railway-pnr-status.p.rapidapi.com/getPNRStatus/${pnr}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': 'irctc-indian-railway-pnr-status.p.rapidapi.com', 'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY } }
      );
      const data = await response.json();
      if (data && data.Destination) { setPnrData(data); toast.success('PNR details fetched!'); }
      else toast.error('Invalid PNR or no data found');
    } catch { toast.error('Failed to fetch PNR'); }
    finally { setFetchingVehicle(false); }
  };

  const fetchBusById = async () => {
    if (!busIdInput.trim()) return;
    setFetchingVehicle(true);
    setBusNotFound(false);
    setBusData(null);
    try {
      const { data } = await supabase
        .from('vehicles').select('*')
        .ilike('vehicle_number', busIdInput.trim())
        .maybeSingle();
      if (data) {
        setBusData(data);
        toast.success(`${data.operator} — ${data.from_location} → ${data.to_location} ✅`);
      } else {
        setBusNotFound(true);
        toast.info('Bus ID not found — please enter route details manually');
      }
    } catch { toast.error('Search failed. Please try again.'); }
    finally { setFetchingVehicle(false); }
  };

  const checkRouteMatches = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) {
      toast.error('Please enter both From and To locations');
      return;
    }
    setFetchingVehicle(true);
    try {
      const { count } = await supabase
        .from('checkins')
        .select('*', { count: 'exact', head: true })
        .ilike('from_location', `%${routeFrom.trim()}%`)
        .ilike('to_location', `%${routeTo.trim()}%`)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());
      setRouteMatches(count || 0);
      setCheckedRoute(true);
      if (count && count > 0) {
        toast.success(`${count} traveler${count > 1 ? 's' : ''} on this route! 🎉`);
      } else {
        toast.info('No one on this route yet — you\'ll be first!');
      }
    } catch { toast.error('Failed to check route'); }
    finally { setFetchingVehicle(false); }
  };

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrData) { toast.error('Please fetch PNR details first'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const arrivalTime = pnrData.DestinationArrival || '11:59 PM';
      const expiresAt = calculateExpiry(arrivalTime, pnrData.DateOfJourney);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: userName, profession,
        vehicle_id: pnrData.TrainNumber || pnr,
        from_location: pnrData.BoardingPoint || pnrData.Origin,
        to_location: pnrData.Destination,
        arrival_time: arrivalTime, expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: userName, profession, vehicleId: pnrData.TrainNumber || pnr, from: pnrData.BoardingPoint || pnrData.Origin, to: pnrData.Destination, arrivalTime });
      toast.success('Checked in! Find your co-travelers 🚆');
      navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const handleBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vehicleId = busData?.vehicle_number || busIdInput.trim() || `MANUAL-${Date.now()}`;
    const fromLocation = busData?.from_location || manualFrom;
    const toLocation = busData?.to_location || manualTo;
    const arrivalTime = busData?.arrival_time || manualArrival || '11:59 PM';
    if (!fromLocation || !toLocation) { toast.error('Please enter route details'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const expiresAt = calculateExpiry(arrivalTime);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: userName, profession,
        vehicle_id: vehicleId, from_location: fromLocation,
        to_location: toLocation, arrival_time: arrivalTime,
        expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: userName, profession, vehicleId, from: fromLocation, to: toLocation, arrivalTime });
      toast.success('Checked in! Find your co-travelers 🚌');
      navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFrom.trim() || !routeTo.trim()) { toast.error('Please enter route details'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const arrivalTime = routeArrival || '11:59 PM';
      const expiresAt = calculateExpiry(arrivalTime);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: userName, profession,
        vehicle_id: `ROUTE-${Date.now()}`,
        from_location: routeFrom.trim(),
        to_location: routeTo.trim(),
        arrival_time: arrivalTime,
        expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: userName, profession, vehicleId: `ROUTE-${Date.now()}`, from: routeFrom, to: routeTo, arrivalTime });
      toast.success('Checked in! Finding route matches 🗺️');
      navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { id: 'reserved-train' as TabType, label: 'Train', icon: Train, color: '#1E88E5', bg: 'bg-blue-500' },
    { id: 'reserved-bus' as TabType, label: 'Bus', icon: Bus, color: '#FF6B35', bg: 'bg-orange-500' },
    { id: 'route-match' as TabType, label: 'Route Match', icon: Navigation, color: '#22c55e', bg: 'bg-green-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-64 h-64 rounded-full bg-[#1E88E5]/10 blur-3xl"
          animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity }}
          style={{ top: '5%', left: '5%' }} />
        <motion.div className="absolute w-80 h-80 rounded-full bg-[#FF6B35]/10 blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, 40, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 12, repeat: Infinity }}
          style={{ bottom: '10%', right: '5%' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-3 px-4 pt-12 pb-4"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CompassLogo />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#534AB7] to-[#D4537E] bg-clip-text text-transparent">
              MeetDestiny
            </h1>
            <p className="text-xs text-gray-500">Start your journey</p>
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="px-4 mb-4"
        >
          <div className="flex rounded-2xl bg-white/60 backdrop-blur p-1.5 gap-1 shadow-md border border-white/40">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setBusData(null);
                  setBusNotFound(false);
                  setCheckedRoute(false);
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white shadow-md text-gray-800'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon
                  className="w-5 h-5"
                  style={{ color: activeTab === tab.id ? tab.color : undefined }}
                />
                <span className="leading-tight text-center text-[11px]">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Form Area ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex-1 px-4 pb-8"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/30">

            {/* Shared profession field — shown always */}
            <div className="mb-5 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#534AB7] to-[#D4537E] flex items-center justify-center text-white text-sm font-bold">
                  {userName.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{userName || 'Loading...'}</p>
                  <p className="text-xs text-gray-400">from your Google account</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Your Profession
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Software Engineer, Student..."
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#534AB7] bg-white text-sm"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* ── TRAIN TAB ── */}
              {activeTab === 'reserved-train' && (
                <motion.form
                  key="train"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleTrainSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Train className="w-3.5 h-3.5 text-[#1E88E5]" /> PNR Number
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Enter 10-digit PNR"
                        value={pnr}
                        onChange={(e) => setPnr(e.target.value)}
                        maxLength={10}
                        className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#1E88E5] bg-white text-sm"
                      />
                      <Button
                        type="button"
                        onClick={fetchPNR}
                        disabled={fetchingVehicle || pnr.length < 10}
                        className="h-12 px-4 rounded-xl bg-[#1E88E5] hover:bg-[#1565C0] text-white shrink-0"
                      >
                        {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      We only use PNR to fetch your journey details — never stored.
                    </p>
                  </div>

                  {pnrData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-blue-50 border-2 border-[#1E88E5]/20 rounded-2xl p-4"
                    >
                      <p className="text-xs font-semibold text-[#1E88E5] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Train className="w-3.5 h-3.5" /> Journey Details
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400 text-xs">Train</span><p className="font-medium text-gray-800">{pnrData.TrainNumber}</p></div>
                        <div><span className="text-gray-400 text-xs">Date</span><p className="font-medium text-gray-800">{pnrData.DateOfJourney}</p></div>
                        <div><span className="text-gray-400 text-xs">From</span><p className="font-medium text-gray-800">{pnrData.BoardingPoint || pnrData.Origin}</p></div>
                        <div><span className="text-gray-400 text-xs">To</span><p className="font-medium text-gray-800">{pnrData.Destination}</p></div>
                        <div><span className="text-gray-400 text-xs">Arrival</span><p className="font-medium text-gray-800">{pnrData.DestinationArrival}</p></div>
                        <div><span className="text-gray-400 text-xs">Class</span><p className="font-medium text-gray-800">{pnrData.Class}</p></div>
                      </div>
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !pnrData || !profession.trim()}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white font-medium shadow-lg disabled:opacity-50 text-base"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '🚆 Start Networking'}
                  </Button>
                </motion.form>
              )}

              {/* ── BUS TAB ── */}
              {activeTab === 'reserved-bus' && (
                <motion.form
                  key="bus"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleBusSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-[#FF6B35]" /> Bus ID
                      <span className="text-gray-400 font-normal">(from sticker on bus)</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="e.g., KSRTC-4X7K"
                        value={busIdInput}
                        onChange={(e) => { setBusIdInput(e.target.value.toUpperCase()); setBusData(null); setBusNotFound(false); }}
                        className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#FF6B35] bg-white font-mono text-sm"
                      />
                      <Button
                        type="button"
                        onClick={fetchBusById}
                        disabled={fetchingVehicle || !busIdInput.trim()}
                        className="h-12 px-4 rounded-xl bg-[#FF6B35] hover:bg-[#E85A2B] text-white shrink-0"
                      >
                        {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {busData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-orange-50 border-2 border-[#FF6B35]/20 rounded-2xl p-4"
                    >
                      <p className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Bus className="w-3.5 h-3.5" /> ✅ Bus Found
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400 text-xs">Operator</span><p className="font-medium text-gray-800">{busData.operator}</p></div>
                        <div><span className="text-gray-400 text-xs">Type</span><p className="font-medium text-gray-800">{busData.vehicle_type}</p></div>
                        <div><span className="text-gray-400 text-xs">From</span><p className="font-medium text-gray-800">{busData.from_location}</p></div>
                        <div><span className="text-gray-400 text-xs">To</span><p className="font-medium text-gray-800">{busData.to_location}</p></div>
                        <div><span className="text-gray-400 text-xs">Departs</span><p className="font-medium text-gray-800">{busData.departure_time}</p></div>
                        <div><span className="text-gray-400 text-xs">Arrives</span><p className="font-medium text-gray-800">{busData.arrival_time}</p></div>
                      </div>
                    </motion.div>
                  )}

                  {busNotFound && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3">
                        <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Bus not registered yet</p>
                        <p className="text-xs text-amber-600">Enter route details manually — we'll register it soon!</p>
                      </div>
                      <Input type="text" placeholder="Bus Operator (e.g., NueGo, KSRTC)" value={manualOperator} onChange={(e) => setManualOperator(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">From City *</label>
                          <Input type="text" placeholder="Bangalore" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">To City *</label>
                          <Input type="text" placeholder="Chennai" value={manualTo} onChange={(e) => setManualTo(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Estimated Arrival *</label>
                        <Input type="time" value={manualArrival} onChange={(e) => setManualArrival(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                      </div>
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || (!busData && !busNotFound)}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E85A2B] text-white font-medium shadow-lg disabled:opacity-50 text-base"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '🚌 Start Networking'}
                  </Button>
                </motion.form>
              )}

              {/* ── ROUTE MATCH TAB ── */}
              {activeTab === 'route-match' && (
                <motion.form
                  key="route"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleRouteSubmit}
                  className="space-y-4"
                >
                  <p className="text-xs text-gray-500 bg-green-50 border border-green-200 rounded-xl p-3">
                    🗺️ No vehicle ID? Enter your route and we'll connect you with others traveling the same path!
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#22c55e]" /> From
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., Bangalore"
                        value={routeFrom}
                        onChange={(e) => { setRouteFrom(e.target.value); setCheckedRoute(false); }}
                        className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#22c55e]" /> To
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., Chennai"
                        value={routeTo}
                        onChange={(e) => { setRouteTo(e.target.value); setCheckedRoute(false); }}
                        className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#22c55e]" /> Estimated Arrival Time
                    </label>
                    <Input
                      type="time"
                      value={routeArrival}
                      onChange={(e) => setRouteArrival(e.target.value)}
                      className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white text-sm"
                    />
                  </div>

                  {/* Check matches button */}
                  <Button
                    type="button"
                    onClick={checkRouteMatches}
                    disabled={fetchingVehicle || !routeFrom.trim() || !routeTo.trim()}
                    className="w-full h-12 rounded-xl bg-green-50 hover:bg-green-100 text-[#22c55e] border-2 border-green-200 font-medium transition-all"
                  >
                    {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🔍 Check Travelers on This Route'}
                  </Button>

                  {checkedRoute && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-2xl p-4 text-center border-2 ${routeMatches > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                      {routeMatches > 0 ? (
                        <>
                          <p className="text-2xl font-bold text-[#22c55e]">{routeMatches}</p>
                          <p className="text-sm text-gray-600">traveler{routeMatches > 1 ? 's' : ''} on <span className="font-medium">{routeFrom} → {routeTo}</span> right now!</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-semibold text-gray-500">No one yet</p>
                          <p className="text-xs text-gray-400">Be the first on this route — others will find you!</p>
                        </>
                      )}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !routeFrom.trim() || !routeTo.trim() || !profession.trim()}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-medium shadow-lg disabled:opacity-50 text-base"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '🗺️ Start Networking'}
                  </Button>
                </motion.form>
              )}

            </AnimatePresence>
          </div>

          {/* Safe travels note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-4 bg-white/60 backdrop-blur border border-white/40 rounded-2xl p-4 shadow-sm"
          >
            <p className="text-xs text-gray-500 text-center">
              ✨ <span className="font-medium text-gray-700">Safe travels!</span> Your check-in expires automatically when you reach your destination.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};