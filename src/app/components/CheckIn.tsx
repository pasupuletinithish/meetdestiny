import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { MapPin, Briefcase, User, Bus, Train, Sparkles, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type TabType = 'reserved-train' | 'reserved-bus' | 'local';

export const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('reserved-train');
  const [loading, setLoading] = useState(false);
  const [fetchingVehicle, setFetchingVehicle] = useState(false);

  // Train
  const [pnr, setPnr] = useState('');
  const [pnrData, setPnrData] = useState<any>(null);
  const [trainName, setTrainName] = useState('');
  const [trainProfession, setTrainProfession] = useState('');

  // Bus
  const [busIdInput, setBusIdInput] = useState('');
  const [busData, setBusData] = useState<any>(null);
  const [busName, setBusName] = useState('');
  const [busProfession, setBusProfession] = useState('');
  const [busNotFound, setBusNotFound] = useState(false);
  // Manual fallback
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualArrival, setManualArrival] = useState('');
  const [manualOperator, setManualOperator] = useState('');

  // Local
  const [localForm, setLocalForm] = useState({
    name: '', profession: '', vehicleId: '', from: '', to: '', arrivalTime: '',
  });

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
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setFetchingVehicle(false);
    }
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

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrData) { toast.error('Please fetch PNR details first'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const arrivalTime = pnrData.DestinationArrival || '11:59 PM';
      const expiresAt = calculateExpiry(arrivalTime, pnrData.DateOfJourney);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: trainName, profession: trainProfession,
        vehicle_id: pnrData.TrainNumber || pnr,
        from_location: pnrData.BoardingPoint || pnrData.Origin,
        to_location: pnrData.Destination,
        arrival_time: arrivalTime, expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: trainName, profession: trainProfession, vehicleId: pnrData.TrainNumber || pnr, from: pnrData.BoardingPoint || pnrData.Origin, to: pnrData.Destination, arrivalTime });
      toast.success('Checked in!'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const handleBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use registered bus data OR manual entry
    const vehicleId = busData?.vehicle_number || busIdInput.trim() || `MANUAL-${Date.now()}`;
    const fromLocation = busData?.from_location || manualFrom;
    const toLocation = busData?.to_location || manualTo;
    const arrivalTime = busData?.arrival_time || manualArrival || '11:59 PM';

    if (!fromLocation || !toLocation) { toast.error('Please enter route details'); return; }
    if (!busName || !busProfession) { toast.error('Please fill your name and profession'); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const expiresAt = calculateExpiry(arrivalTime);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: busName, profession: busProfession,
        vehicle_id: vehicleId, from_location: fromLocation,
        to_location: toLocation, arrival_time: arrivalTime,
        expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: busName, profession: busProfession, vehicleId, from: fromLocation, to: toLocation, arrivalTime });
      toast.success('Checked in!'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const expiresAt = calculateExpiry(localForm.arrivalTime);
      const { error } = await supabase.from('checkins').insert({
        user_id: user.id, name: localForm.name, profession: localForm.profession,
        vehicle_id: localForm.vehicleId, from_location: localForm.from,
        to_location: localForm.to, arrival_time: localForm.arrivalTime,
        expires_at: expiresAt, is_active: true,
      });
      if (error) throw error;
      setCurrentUser({ name: localForm.name, profession: localForm.profession, vehicleId: localForm.vehicleId, from: localForm.from, to: localForm.to, arrivalTime: localForm.arrivalTime });
      toast.success('Checked in!'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { id: 'reserved-train' as TabType, label: 'Reserved Train', icon: Train, color: '#1E88E5' },
    { id: 'reserved-bus' as TabType, label: 'Reserved Bus', icon: Bus, color: '#FF6B35' },
    { id: 'local' as TabType, label: 'Local / Unreserved', icon: MapPin, color: '#22c55e' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-80 h-80 rounded-full bg-[#1E88E5]/10 blur-3xl" animate={{ x: [0,100,0], y: [0,-50,0], scale: [1,1.2,1] }} transition={{ duration: 10, repeat: Infinity }} style={{ top: '5%', left: '5%' }} />
        <motion.div className="absolute w-96 h-96 rounded-full bg-[#FF6B35]/10 blur-3xl" animate={{ x: [0,-100,0], y: [0,50,0], scale: [1,1.3,1] }} transition={{ duration: 12, repeat: Infinity }} style={{ bottom: '10%', right: '5%' }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col px-6 py-8">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-6">
          <motion.div className="inline-flex items-center gap-2 mb-3" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}>
            <Sparkles className="w-7 h-7 text-[#1E88E5]" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent">Destiny</h1>
            <Sparkles className="w-7 h-7 text-[#FF6B35]" />
          </motion.div>
          <p className="text-gray-600 text-sm">Start your journey, find your connections</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="flex-1 flex items-start justify-center">
          <div className="w-full max-w-md">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
              <h2 className="text-2xl font-semibold text-center mb-1 bg-gradient-to-r from-[#1E88E5] to-[#FF6B35] bg-clip-text text-transparent">Check In</h2>
              <p className="text-gray-500 text-center text-sm mb-5">Select your journey type</p>

              <div className="flex rounded-2xl bg-gray-100 p-1 mb-6 gap-1">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setBusData(null); setBusNotFound(false); }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium transition-all duration-300 ${activeTab === tab.id ? 'bg-white shadow-md text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                    <tab.icon className="w-4 h-4" style={{ color: activeTab === tab.id ? tab.color : undefined }} />
                    <span className="leading-tight text-center">{tab.label}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

                {/* ── TRAIN ── */}
                {activeTab === 'reserved-train' && (
                  <motion.form key="train" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }} onSubmit={handleTrainSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Train className="w-4 h-4 text-[#1E88E5]" /> PNR Number</label>
                      <div className="flex gap-2">
                        <Input type="text" placeholder="Enter 10-digit PNR" value={pnr} onChange={(e) => setPnr(e.target.value)} maxLength={10} className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#1E88E5] bg-white" />
                        <Button type="button" onClick={fetchPNR} disabled={fetchingVehicle || pnr.length < 10} className="h-12 px-4 rounded-xl bg-[#1E88E5] hover:bg-[#1565C0] text-white shrink-0">
                          {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      onClick={() => { setPnr('1234567890'); setPnrData({ TrainNumber: '12627', TrainName: 'Karnataka Express', DateOfJourney: new Date().toLocaleDateString('en-IN'), BoardingPoint: 'Bangalore', Origin: 'Bangalore', Destination: 'Delhi', DestinationArrival: '06:30 AM', Class: 'SL' }); toast.success('Test data loaded!'); }}
                      className="w-full text-xs text-center py-2 px-4 rounded-xl border-2 border-dashed border-[#1E88E5]/40 text-[#1E88E5] hover:bg-[#1E88E5]/5 transition-all duration-200">
                      🧪 Use Test Data (Dev Only)
                    </motion.button>

                    {pnrData && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 border-2 border-[#1E88E5]/30 rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#1E88E5] uppercase tracking-wide mb-2">Journey Details</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Train:</span> <span className="font-medium">{pnrData.TrainNumber}</span></div>
                          <div><span className="text-gray-500">Date:</span> <span className="font-medium">{pnrData.DateOfJourney}</span></div>
                          <div><span className="text-gray-500">From:</span> <span className="font-medium">{pnrData.BoardingPoint || pnrData.Origin}</span></div>
                          <div><span className="text-gray-500">To:</span> <span className="font-medium">{pnrData.Destination}</span></div>
                          <div><span className="text-gray-500">Arrival:</span> <span className="font-medium">{pnrData.DestinationArrival}</span></div>
                          <div><span className="text-gray-500">Class:</span> <span className="font-medium">{pnrData.Class}</span></div>
                        </div>
                      </motion.div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-[#1E88E5]" /> Your Name</label>
                      <Input type="text" placeholder="Enter your name" value={trainName} onChange={(e) => setTrainName(e.target.value)} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#1E88E5] bg-white" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#1E88E5]" /> Profession</label>
                      <Input type="text" placeholder="e.g., Software Engineer" value={trainProfession} onChange={(e) => setTrainProfession(e.target.value)} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#1E88E5] bg-white" />
                    </div>
                    <Button type="submit" disabled={loading || !pnrData} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white font-medium shadow-lg disabled:opacity-50">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Networking'}
                    </Button>
                  </motion.form>
                )}

                {/* ── BUS ── */}
                {activeTab === 'reserved-bus' && (
                  <motion.form key="bus" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }} onSubmit={handleBusSubmit} className="space-y-4">

                    {/* Bus ID input */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-[#FF6B35]" /> Bus ID
                        <span className="text-xs text-gray-400 font-normal ml-1">(from sticker on bus)</span>
                      </label>
                      <div className="flex gap-2">
                        <Input type="text" placeholder="e.g., KSRTC-4X7K or NUEGO-8M2P"
                          value={busIdInput}
                          onChange={(e) => { setBusIdInput(e.target.value.toUpperCase()); setBusData(null); setBusNotFound(false); }}
                          className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#FF6B35] bg-white font-mono" />
                        <Button type="button" onClick={fetchBusById} disabled={fetchingVehicle || !busIdInput.trim()}
                          className="h-12 px-4 rounded-xl bg-[#FF6B35] hover:bg-[#E85A2B] text-white shrink-0">
                          {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Found bus details */}
                    {busData && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-orange-50 border-2 border-[#FF6B35]/30 rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wide mb-2">✅ Bus Found</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Operator:</span> <span className="font-medium">{busData.operator}</span></div>
                          <div><span className="text-gray-500">Type:</span> <span className="font-medium">{busData.vehicle_type}</span></div>
                          <div><span className="text-gray-500">From:</span> <span className="font-medium">{busData.from_location}</span></div>
                          <div><span className="text-gray-500">To:</span> <span className="font-medium">{busData.to_location}</span></div>
                          <div><span className="text-gray-500">Departs:</span> <span className="font-medium">{busData.departure_time}</span></div>
                          <div><span className="text-gray-500">Arrives:</span> <span className="font-medium">{busData.arrival_time}</span></div>
                        </div>
                        {busData.stops?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Stops:</p>
                            <p className="text-xs text-gray-700">{busData.stops.join(' → ')}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Not found — manual fallback */}
                    {busNotFound && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="space-y-3">
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                          <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Bus not registered yet</p>
                          <p className="text-xs text-amber-600">This bus hasn't been added to our system. Please enter the route details manually below — we'll register it soon!</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Bus Operator</label>
                          <Input type="text" placeholder="e.g., NueGo, KSRTC" value={manualOperator} onChange={(e) => setManualOperator(e.target.value)} className="h-11 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">From City *</label>
                            <Input type="text" placeholder="Bangalore" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} className="h-11 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">To City *</label>
                            <Input type="text" placeholder="Chennai" value={manualTo} onChange={(e) => setManualTo(e.target.value)} className="h-11 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Estimated Arrival Time *</label>
                          <Input type="time" value={manualArrival} onChange={(e) => setManualArrival(e.target.value)} className="h-11 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                        </div>
                      </motion.div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-[#FF6B35]" /> Your Name</label>
                      <Input type="text" placeholder="Enter your name" value={busName} onChange={(e) => setBusName(e.target.value)} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#FF6B35] bg-white" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#FF6B35]" /> Profession</label>
                      <Input type="text" placeholder="e.g., Software Engineer" value={busProfession} onChange={(e) => setBusProfession(e.target.value)} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#FF6B35] bg-white" />
                    </div>
                    <Button type="submit" disabled={loading || (!busData && !busNotFound)}
                      className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E85A2B] text-white font-medium shadow-lg disabled:opacity-50">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Networking'}
                    </Button>
                  </motion.form>
                )}

                {/* ── LOCAL ── */}
                {activeTab === 'local' && (
                  <motion.form key="local" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }} onSubmit={handleLocalSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-[#22c55e]" /> Your Name</label>
                      <Input type="text" placeholder="Enter your name" value={localForm.name} onChange={(e) => setLocalForm({ ...localForm, name: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#22c55e]" /> Profession</label>
                      <Input type="text" placeholder="e.g., Software Engineer" value={localForm.profession} onChange={(e) => setLocalForm({ ...localForm, profession: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Bus className="w-4 h-4 text-[#22c55e]" /> Vehicle ID</label>
                      <Input type="text" placeholder="e.g., BUS-101 or any ID" value={localForm.vehicleId} onChange={(e) => setLocalForm({ ...localForm, vehicleId: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#22c55e]" /> From</label>
                        <Input type="text" placeholder="Origin" value={localForm.from} onChange={(e) => setLocalForm({ ...localForm, from: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#22c55e]" /> To</label>
                        <Input type="text" placeholder="Destination" value={localForm.to} onChange={(e) => setLocalForm({ ...localForm, to: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#22c55e]" /> Estimated Arrival Time</label>
                      <Input type="time" value={localForm.arrivalTime} onChange={(e) => setLocalForm({ ...localForm, arrivalTime: e.target.value })} required className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white" />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-medium shadow-lg disabled:opacity-50">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Networking'}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.6 }} className="mt-6 bg-gradient-to-r from-[#FFE8E0] to-[#FFE8E0]/60 backdrop-blur-sm border-2 border-[#FF6B35]/30 rounded-2xl p-4 shadow-lg">
              <p className="text-sm text-gray-800 text-center">
                <span className="font-semibold text-[#FF6B35]">✨ Safe travels!</span>{' '}
                Your check-in expires automatically when you reach your destination.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};