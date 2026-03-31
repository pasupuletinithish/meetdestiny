import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Search, LogOut, Loader2, Download, ShieldAlert, ShieldCheck, Users, Flag, CheckCircle, XCircle, Clock, Trophy, Plus, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  vehicle_number: string;
  operator: string;
  vehicle_type: string;
  from_location: string;
  to_location: string;
  departure_time: string;
  arrival_time: string;
  forward_departure: string;
  return_departure: string;
  cooldown_hours?: number;
  stops: string[];
  bus_plate?: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  avatar_url?: string;
  is_banned: boolean;
  warn_count: number;
  role: string;
  total_journeys: number;
  created_at: string;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  context: string;
  status: string;
  created_at: string;
  reporter?: { name: string };
  reported?: { name: string };
}

interface Coupon {
  id: string;
  code: string;
  is_used: boolean;
  used_at?: string;
  created_at: string;
}

interface ContestWinner {
  id: string;
  winner_name: string;
  winner_email: string;
  vehicle_id: string;
  contest_type: string;
  score: number;
  email_sent: boolean;
  journey_date: string;
  created_at: string;
}

function generateRoutePrefix(from: string, to: string): string {
  const clean = (s: string) => s.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return `${clean(from)}-${clean(to)}`;
}

function generateBulkIds(from: string, to: string, count: number, startFrom: number): string[] {
  const prefix = generateRoutePrefix(from, to);
  return Array.from({ length: count }, (_, i) => {
    const num = String(startFrom + i).padStart(4, '0');
    return `${prefix}-${num}`;
  });
}

function getQRUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=1E88E5&margin=2`;
}

async function downloadFlyer(vehicle: Vehicle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d')!;

  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  const qrLoadPromise = new Promise((resolve) => {
    qrImg.onload = () => resolve(true);
    qrImg.onerror = () => resolve(false);
    qrImg.src = getQRUrl(vehicle.vehicle_number);
  });
  await qrLoadPromise;

  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1800);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 1800);

  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.roundRect(0, 0, 1200, 450, [0, 0, 80, 80]);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 90px sans-serif';
  ctx.fillText('DESTINY', 600, 180);
  ctx.font = '34px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('NETWORK • CONNECT • TRAVEL', 600, 240);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.roundRect(150, 290, 900, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(`${vehicle.from_location?.toUpperCase()} ↔ ${vehicle.to_location?.toUpperCase()}`, 600, 355);

  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 50;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(150, 480, 900, 1150, 60);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FF6B35';
  ctx.beginPath();
  ctx.roundRect(400, 520, 400, 60, 30);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(vehicle.operator, 600, 560);

  if (qrImg.complete) ctx.drawImage(qrImg, 350, 650, 500, 500);

  if (vehicle.forward_departure || vehicle.return_departure) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(250, 1190, 700, 80, 20);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '24px sans-serif';
    const depText = [
      vehicle.forward_departure ? `→ ${vehicle.from_location}: ${vehicle.forward_departure}` : '',
      vehicle.return_departure ? `← ${vehicle.to_location}: ${vehicle.return_departure}` : '',
    ].filter(Boolean).join('   ');
    ctx.fillText(depText, 600, 1240);
  }

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(250, 1300);
  ctx.lineTo(950, 1300);
  ctx.stroke();

  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.roundRect(250, 1350, 700, 150, 30);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px monospace';
  ctx.fillText(vehicle.vehicle_number, 600, 1450);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('Scan to join the Lounge', 600, 1560);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Connect with verified co-travelers instantly.', 600, 1610);

  ctx.fillStyle = '#1E88E5';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('meetdestiny.online • Your paths were meant to meet', 600, 1750);

  const link = document.createElement('a');
  link.download = `Flyer-${vehicle.vehicle_number}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [winners, setWinners] = useState<ContestWinner[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'add' | 'users' | 'reports' | 'contests'>('list');
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editForwardDep, setEditForwardDep] = useState('');
  const [editReturnDep, setEditReturnDep] = useState('');
  const [editCooldown, setEditCooldown] = useState(9);

  // Contest state
  const [couponInput, setCouponInput] = useState('');
  const [savingCoupons, setSavingCoupons] = useState(false);
  const [triggeringWinner, setTriggeringWinner] = useState<string | null>(null);
  const [contestVehicleId, setContestVehicleId] = useState('');
  const [vehicleTravelers, setVehicleTravelers] = useState<any[]>([]);
  const [searchingTravelers, setSearchingTravelers] = useState(false);

  const [form, setForm] = useState({
    operator: '',
    from_location: '',
    to_location: '',
    vehicle_type: 'bus',
    count: 5,
    forward_departure: '',
    return_departure: '',
    cooldown_hours: 9,
  });

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchVehicles(), fetchUsers(), fetchReports(), fetchCoupons(), fetchWinners()]);
      setLoading(false);
    };
    init();
  }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setVehicles(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
  };

  const fetchReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (data) {
      const enriched = await Promise.all(data.map(async (r) => {
        let reporterName = await supabase.from('user_profiles').select('name').eq('user_id', r.reporter_id).maybeSingle().then(res => res.data?.name);
        if (!reporterName) reporterName = await supabase.from('checkins').select('name').eq('user_id', r.reporter_id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(res => res.data?.name);
        let reportedName = await supabase.from('user_profiles').select('name').eq('user_id', r.reported_id).maybeSingle().then(res => res.data?.name);
        if (!reportedName) reportedName = await supabase.from('checkins').select('name').eq('user_id', r.reported_id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(res => res.data?.name);
        return { ...r, reporter: { name: reporterName || 'Unknown User' }, reported: { name: reportedName || 'Unknown User' } };
      }));
      setReports(enriched);
    }
  };

  const fetchCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
  };

  const fetchWinners = async () => {
    const { data } = await supabase.from('contest_winners').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) {
      const enriched = await Promise.all(data.map(async (w: any) => {
        let name = w.winner_name;
        if (!name && w.user_id) {
          name = await supabase.from('user_profiles').select('name').eq('user_id', w.user_id).maybeSingle().then(res => res.data?.name);
          if (!name) name = await supabase.from('checkins').select('name').eq('user_id', w.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(res => res.data?.name);
        }
        return { ...w, winner_name: name || 'Unknown User' };
      }));
      setWinners(enriched as ContestWinner[]);
    } else {
      setWinners([]);
    }
  };

  const handleBan = async (userId: string, userName: string) => {
    setActionLoading(userId);
    const { error } = await supabase.from('user_profiles').update({ is_banned: true, warn_count: 2 }).eq('user_id', userId);
    if (!error) { setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_banned: true } : u)); toast.error(`${userName} has been banned.`); }
    else toast.error('Failed to ban user');
    setActionLoading(null);
  };

  const handleUnban = async (userId: string, userName: string) => {
    setActionLoading(userId);
    const { data, error } = await supabase.from('user_profiles').update({ is_banned: false, warn_count: 0 }).eq('user_id', userId).select();
    if (!error && data?.length > 0) { setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_banned: false, warn_count: 0 } : u)); toast.success(`${userName} has been unbanned! ✅`); }
    else toast.error('Failed to unban user');
    setActionLoading(null);
  };

  const handleReviewReport = async (reportId: string, action: 'actioned' | 'dismissed', reportedId?: string, reportedName?: string) => {
    setActionLoading(reportId);
    if (action === 'actioned' && reportedId) await handleBan(reportedId, reportedName || 'User');
    await supabase.from('reports').update({ status: action }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: action } : r));
    toast.success(action === 'actioned' ? '🚫 User banned!' : '✅ Report dismissed');
    setActionLoading(null);
  };

  const handlePreview = () => {
    if (!form.operator || !form.from_location || !form.to_location) { toast.error('Missing route details'); return; }
    const prefix = generateRoutePrefix(form.from_location, form.to_location);
    const existing = vehicles.filter(v => v.vehicle_number?.startsWith(prefix));
    const maxNum = existing.reduce((max, v) => {
      const parts = v.vehicle_number?.split('-') || [];
      const num = parseInt(parts[parts.length - 1]) || 100;
      return Math.max(max, num);
    }, 100);
    const ids = generateBulkIds(form.from_location, form.to_location, form.count, maxNum + 1);
    setPreviewIds(ids);
  };

  const handleSaveBulk = async () => {
    setSaving(true);
    const rows = previewIds.map(id => ({
      vehicle_number: id,
      vehicle_type: form.vehicle_type,
      operator: form.operator,
      from_location: form.from_location,
      to_location: form.to_location,
      departure_time: form.forward_departure || '00:00',
      arrival_time: '23:59',
      forward_departure: form.forward_departure || null,
      return_departure: form.return_departure || null,
      cooldown_hours: form.cooldown_hours,
      stops: [],
      is_active: true,
      ai_sourced: false,
      confidence: 'high',
      source: 'admin_registered',
    }));
    const { error } = await supabase.from('vehicles').insert(rows);
    if (!error) { toast.success(`${previewIds.length} buses registered! 🎉`); setPreviewIds([]); setActiveView('list'); fetchVehicles(); }
    else toast.error(`Failed: ${error.message}`);
    setSaving(false);
  };

  const handleSaveDepartureTimes = async (vehicleId: string) => {
    const { error } = await supabase.from('vehicles').update({
      forward_departure: editForwardDep || null,
      return_departure: editReturnDep || null,
      departure_time: editForwardDep || '00:00',
      cooldown_hours: editCooldown || 9,
    }).eq('id', vehicleId);
    if (!error) { toast.success('Departure times saved! ✅'); setEditingVehicleId(null); fetchVehicles(); }
    else toast.error('Failed to save');
  };

  // ── Upload coupons ────────────────────────────────────────
  const handleUploadCoupons = async () => {
    const codes = couponInput
      .split(/[\n,]/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);

    if (codes.length === 0) { toast.error('Please enter at least one coupon code'); return; }

    setSavingCoupons(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = codes.map(code => ({ code, is_used: false, uploaded_by: user?.id }));
      const { error } = await supabase.from('coupons').insert(rows);
      if (error) throw error;
      toast.success(`${codes.length} coupon${codes.length > 1 ? 's' : ''} uploaded! 🎟️`);
      setCouponInput('');
      await fetchCoupons();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSavingCoupons(false);
    }
  };

  // ── Delete coupon ─────────────────────────────────────────
  const handleDeleteCoupon = async (couponId: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', couponId);
    if (!error) { setCoupons(prev => prev.filter(c => c.id !== couponId)); toast.success('Coupon removed'); }
    else toast.error('Failed to delete');
  };

  // ── Manually trigger winner pick ──────────────────────────
  const handleTriggerWinner = async () => {
    if (!contestVehicleId.trim()) { toast.error('Enter a vehicle ID first'); return; }
    setTriggeringWinner(contestVehicleId);
    try {
      const { data, error } = await supabase.functions.invoke('pick-winner', {
        body: { vehicle_id: contestVehicleId.trim() }
      });
      if (error) throw error;
      if (data?.winner) {
        toast.success(`🏆 Winner: ${data.winner.name} — ${data.contest}`);
        await fetchWinners();
        await fetchCoupons();
        setContestVehicleId('');
      } else {
        toast.info(data?.message || 'No winner picked');
      }
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setTriggeringWinner(null);
    }
  };

  const handleSearchTravelers = async () => {
    if (!contestVehicleId.trim()) { toast.error('Enter a vehicle ID first'); return; }
    setSearchingTravelers(true);
    const { data, error } = await supabase.from('checkins').select('user_id, name').eq('vehicle_id', contestVehicleId.trim());
    if (error) { toast.error('Failed to search'); }
    else if (!data || data.length === 0) { toast.info('No active travelers found on this vehicle'); setVehicleTravelers([]); }
    else { setVehicleTravelers(data); toast.success(`Found ${data.length} traveler(s)`); }
    setSearchingTravelers(false);
  };

  const handlePickManualWinner = async (userId: string) => {
    setTriggeringWinner(contestVehicleId);
    try {
      const { data, error } = await supabase.functions.invoke('pick-winner', {
        body: { vehicle_id: contestVehicleId.trim(), manual_winner_id: userId }
      });
      if (error) throw error;
      if (data?.winner) {
        toast.success(`🏆 Winner: ${data.winner.name} — ${data.contest} (Manual override)`);
        await fetchWinners();
        await fetchCoupons();
        setContestVehicleId('');
        setVehicleTravelers([]);
      } else {
        toast.info(data?.message || 'No winner picked');
      }
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setTriggeringWinner(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.profession?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingReports = reports.filter(r => r.status === 'pending');
  const bannedCount = users.filter(u => u.is_banned).length;
  const warnedCount = users.filter(u => u.warn_count > 0 && !u.is_banned).length;
  const availableCoupons = coupons.filter(c => !c.is_used).length;
  const usedCoupons = coupons.filter(c => c.is_used).length;

  const filteredVehicles = vehicles.filter(v =>
    v.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.operator?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.from_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.to_location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CONTEST_SCHEDULE = [
    { day: 'Monday', name: 'Social Butterfly 🦋', desc: 'Most pings sent' },
    { day: 'Tuesday', name: 'Best Connector 🤝', desc: 'Most mutual matches' },
    { day: 'Wednesday', name: 'Lounge Star 💬', desc: 'Most messages' },
    { day: 'Thursday', name: 'Early Bird 🐦', desc: 'First to check in' },
    { day: 'Friday', name: 'Friend Magnet 👥', desc: 'Most friends added' },
    { day: 'Saturday', name: 'Lucky Draw 🎰', desc: 'Random winner' },
    { day: 'Sunday', name: 'All Rounder 🏆', desc: 'Combined score' },
  ];
  const todayContest = CONTEST_SCHEDULE[new Date().getDay()];

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto h-screen flex flex-col bg-slate-50 font-sans shadow-2xl">

      {/* ── Header ── */}
      <div className="bg-blue-600 p-4 text-white">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-black italic">DESTINY ADMIN</h1>
          <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-lg"><LogOut size={18} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-base font-black">{users.length}</p><p className="text-[10px] opacity-70">Users</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-base font-black text-red-300">{bannedCount}</p><p className="text-[10px] opacity-70">Banned</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-base font-black text-yellow-300">{pendingReports.length}</p><p className="text-[10px] opacity-70">Reports</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-base font-black text-green-300">{availableCoupons}</p><p className="text-[10px] opacity-70">Coupons</p></div>
        </div>

        {/* Tabs — 5 tabs now */}
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: 'list', label: 'BUSES' },
            { id: 'add', label: 'ADD' },
            { id: 'users', label: 'USERS' },
            { id: 'reports', label: `RPT${pendingReports.length > 0 ? `(${pendingReports.length})` : ''}` },
            { id: 'contests', label: '🏆' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id as any)}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${activeView === tab.id ? 'bg-white text-blue-600' : 'bg-white/10 text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ── BUSES TAB ── */}
        {activeView === 'list' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input className="w-full p-3 pl-10 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Search route or ID..." onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-slate-400"><Bus size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No buses registered yet</p></div>
            ) : (
              filteredVehicles.map(v => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-blue-600 font-mono font-bold text-lg">{v.vehicle_number}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">{v.from_location} ↔ {v.to_location}</div>
                      <div className="text-xs text-slate-400">{v.operator}</div>
                    </div>
                    <button onClick={() => downloadFlyer(v)} className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <Download size={20} />
                    </button>
                  </div>

                  {(v.forward_departure || v.return_departure) ? (
                    <div className="flex gap-2 mb-2">
                      {v.forward_departure && (
                        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1">
                          <span className="text-xs">→</span>
                          <span className="text-xs font-bold text-blue-600">{v.from_location?.slice(0, 3)}: {v.forward_departure}</span>
                        </div>
                      )}
                      {v.return_departure && (
                        <div className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-2 py-1">
                          <span className="text-xs">←</span>
                          <span className="text-xs font-bold text-orange-600">{v.to_location?.slice(0, 3)}: {v.return_departure}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300 mb-2 italic">No departure times set</div>
                  )}

                  {editingVehicleId === v.id ? (
                    <div className="space-y-3 mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-600 flex items-center gap-1"><Clock size={12} /> Set Trip Info</p>
                      <div className="flex gap-2 items-center bg-blue-50/50 p-2 rounded-lg border border-blue-50">
                        <label className="text-xs text-slate-600 font-bold w-20">Trip Cooldown</label>
                        <input type="number" min="1" max="72" value={editCooldown} onChange={e => setEditCooldown(parseInt(e.target.value) || 9)}
                          className="w-16 h-8 rounded-lg border border-slate-200 px-2 text-sm text-center font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                        <span className="text-xs text-slate-500">hours</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">→ {v.from_location} departs</label>
                          <input type="time" value={editForwardDep} onChange={e => setEditForwardDep(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">← {v.to_location} departs</label>
                          <input type="time" value={editReturnDep} onChange={e => setEditReturnDep(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleSaveDepartureTimes(v.id)} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">Save Changes</button>
                        <button onClick={() => setEditingVehicleId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingVehicleId(v.id); setEditForwardDep(v.forward_departure || ''); setEditReturnDep(v.return_departure || ''); setEditCooldown(v.cooldown_hours || 9); }}
                      className="w-full py-2 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-1">
                      <Clock size={12} />
                      {v.forward_departure || v.return_departure || v.cooldown_hours ? 'Edit route settings' : 'Add route settings'}
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── ADD BUSES TAB ── */}
        {activeView === 'add' && (
          <div className="space-y-4 bg-white p-6 rounded-3xl shadow-sm">
            <h2 className="font-bold text-slate-800">Bulk Registration</h2>
            <div className="bg-blue-50 rounded-2xl p-3 text-xs text-blue-700">
              <p className="font-bold mb-1">How it works:</p>
              <p>Generate IDs like <span className="font-mono font-bold">BAN-CHE-0101</span> for Bangalore↔Chennai buses. Each ID is permanent for that physical bus.</p>
            </div>
            <input placeholder="Operator Name (e.g. KSRTC, NueGo)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-sm"
              value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })} />
            <div className="flex gap-2">
              <input placeholder="From City" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none text-sm"
                value={form.from_location} onChange={e => setForm({ ...form, from_location: e.target.value })} />
              <input placeholder="To City" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none text-sm"
                value={form.to_location} onChange={e => setForm({ ...form, to_location: e.target.value })} />
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5"><Clock size={13} /> Departure Times (Both Directions)</p>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">→ <span className="font-semibold">{form.from_location || 'Origin'}</span> departure time</label>
                <input type="time" value={form.forward_departure} onChange={e => setForm({ ...form, forward_departure: e.target.value })}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">← <span className="font-semibold">{form.to_location || 'Destination'}</span> departure time (return)</label>
                <input type="time" value={form.return_departure} onChange={e => setForm({ ...form, return_departure: e.target.value })}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-400" />
              </div>
              <p className="text-xs text-slate-400">💡 Can be edited per bus later.</p>
            </div>
            {form.from_location && form.to_location && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-bold">ID format: <span className="font-mono">{generateRoutePrefix(form.from_location, form.to_location)}-0101</span></p>
              </div>
            )}
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs font-bold text-blue-600 mb-2 uppercase">Quantity: {form.count}</p>
              <input type="range" min="1" max="20" value={form.count} className="w-full accent-blue-600 mb-1"
                onChange={e => setForm({ ...form, count: parseInt(e.target.value) })} />
              <div className="flex justify-between text-xs text-slate-400"><span>1 bus</span><span>20 buses</span></div>
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><Clock size={14} /> Trip Cooldown</p>
                <div className="bg-white px-2 py-0.5 rounded-md text-xs font-bold font-mono text-blue-600 border border-blue-200">{form.cooldown_hours} hrs</div>
              </div>
              <p className="text-[10px] text-blue-600/70 mb-3 font-medium">Prevents multiple winners from being picked too quickly. Usually set to the duration of the journey.</p>
              <input type="range" min="2" max="48" step="1" value={form.cooldown_hours} className="w-full accent-blue-600 mb-1"
                onChange={e => setForm({ ...form, cooldown_hours: parseInt(e.target.value) })} />
              <div className="flex justify-between text-xs font-medium text-blue-600/60"><span>2 hrs</span><span>48 hrs</span></div>
            </div>
            <div className="flex gap-2">
              {['bus', 'mini-bus', 'sleeper', 'ac-sleeper'].map(type => (
                <button key={type} type="button" onClick={() => setForm({ ...form, vehicle_type: type })}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${form.vehicle_type === type ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {type}
                </button>
              ))}
            </div>
            <button onClick={handlePreview} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl">Preview IDs</button>
            {previewIds.length > 0 && (
              <div className="pt-4 border-t space-y-4">
                <p className="text-xs font-bold text-slate-600">{previewIds.length} IDs will be created:</p>
                <div className="flex flex-wrap gap-2">
                  {previewIds.map(id => (<span key={id} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-mono">{id}</span>))}
                </div>
                <button onClick={handleSaveBulk} disabled={saving} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl shadow-lg shadow-green-200">
                  {saving ? 'Registering...' : `✅ Confirm & Save ${previewIds.length} Buses`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeView === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input className="w-full p-3 pl-10 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {[{ label: `All (${users.length})`, filter: 'all' }, { label: `⚠️ Warned (${warnedCount})`, filter: 'warned' }, { label: `🚫 Banned (${bannedCount})`, filter: 'banned' }].map(f => (
                <button key={f.filter} onClick={() => setUserSearch(f.filter === 'all' ? '' : f.filter)} className="flex-1 py-2 text-xs font-bold bg-white rounded-xl shadow-sm border border-slate-100">{f.label}</button>
              ))}
            </div>
            {filteredUsers.map(user => (
              <motion.div key={user.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white p-4 rounded-2xl shadow-sm border ${user.is_banned ? 'border-red-200 bg-red-50' : user.warn_count > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {user.is_banned && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><XCircle size={12} className="text-white" /></div>}
                    {!user.is_banned && user.warn_count > 0 && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center"><ShieldAlert size={12} className="text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 truncate">{user.name}</p>
                      {user.role === 'admin' && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">ADMIN</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{user.profession}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {user.is_banned ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">🚫 Banned</span>
                        : user.warn_count > 0 ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">⚠️ {user.warn_count} warning{user.warn_count > 1 ? 's' : ''}</span>
                        : <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">✅ Clean</span>}
                    </div>
                  </div>
                  {user.role !== 'admin' && (
                    <div>
                      {actionLoading === user.user_id ? <Loader2 size={20} className="animate-spin text-slate-400" />
                        : user.is_banned ? (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleUnban(user.user_id, user.name)} className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl shadow-sm">
                            <ShieldCheck size={14} />Unban
                          </motion.button>
                        ) : (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleBan(user.user_id, user.name)} className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl shadow-sm">
                            <ShieldAlert size={14} />Ban
                          </motion.button>
                        )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {filteredUsers.length === 0 && <div className="text-center py-12 text-slate-400"><Users size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No users found</p></div>}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeView === 'reports' && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Flag size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold text-slate-600 mb-2">No reports yet, or database is misconfigured</p>
                <div className="mt-6 max-w-sm mx-auto bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-left text-xs leading-relaxed">
                  <p className="font-bold mb-1 flex items-center gap-1.5"><ShieldAlert size={14} /> Row-Level Security (RLS) Block</p>
                  <p className="mb-3">If users are clicking "Report" but nothing appears here, your Supabase `reports` table is blocking inserts. Run this in your Supabase SQL Editor:</p>
                  <div className="font-mono bg-white p-2.5 rounded-lg border border-orange-100 overflow-x-auto text-[10px] whitespace-pre">
                    CREATE POLICY "allow_inserts"{'\n'}
                    ON public.reports FOR INSERT{'\n'}
                    TO authenticated{'\n'}
                    WITH CHECK (auth.uid() = reporter_id);{'\n\n'}
                    CREATE POLICY "allow_select"{'\n'}
                    ON public.reports FOR SELECT{'\n'}
                    TO authenticated{'\n'}
                    USING (true);
                  </div>
                </div>
              </div>
            ) : (
              reports.map(report => (
                <motion.div key={report.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-white p-4 rounded-2xl shadow-sm border ${report.status === 'pending' ? 'border-orange-200' : report.status === 'actioned' ? 'border-red-200' : 'border-green-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${report.status === 'pending' ? 'bg-orange-100 text-orange-600' : report.status === 'actioned' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {report.status === 'pending' ? '⏳ Pending' : report.status === 'actioned' ? '🚫 Actioned' : '✅ Dismissed'}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-blue-600">{report.reporter?.name}</span>
                    <span className="text-xs text-slate-400">reported</span>
                    <span className="text-xs font-bold text-red-600">{report.reported?.name}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-slate-600 mb-1">Reason:</p>
                    <p className="text-sm text-slate-700">{report.reason}</p>
                    {report.context && (<><p className="text-xs font-bold text-slate-600 mt-2 mb-1">Context:</p><p className="text-xs text-slate-500">{report.context}</p></>)}
                  </div>
                  {report.status === 'pending' && (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} disabled={!!actionLoading}
                        onClick={() => handleReviewReport(report.id, 'actioned', report.reported_id, report.reported?.name)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl">
                        {actionLoading === report.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}Ban User
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={!!actionLoading}
                        onClick={() => handleReviewReport(report.id, 'dismissed')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white text-xs font-bold rounded-xl">
                        {actionLoading === report.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Dismiss
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── CONTESTS TAB ── */}
        {activeView === 'contests' && (
          <div className="space-y-4">

            {/* Today's contest */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-4 text-white">
              <p className="text-xs font-bold opacity-80 uppercase tracking-wide mb-1">Today's Contest</p>
              <p className="text-xl font-black">{todayContest.name}</p>
              <p className="text-sm opacity-90">{todayContest.desc}</p>
            </div>

            {/* Weekly schedule */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Weekly Schedule</p>
              <div className="space-y-2">
                {CONTEST_SCHEDULE.map((c, i) => (
                  <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${c.day === DAY_NAMES[new Date().getDay()] ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-20 ${c.day === DAY_NAMES[new Date().getDay()] ? 'text-yellow-600' : 'text-slate-400'}`}>{c.day}</span>
                      <span className="text-xs text-slate-700 font-medium">{c.name}</span>
                    </div>
                    {c.day === DAY_NAMES[new Date().getDay()] && <span className="text-xs bg-yellow-400 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Coupon stock */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-green-600">{availableCoupons}</p>
                <p className="text-xs text-green-600 font-bold">Available</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-slate-400">{usedCoupons}</p>
                <p className="text-xs text-slate-400 font-bold">Used</p>
              </div>
            </div>

            {/* Upload coupons */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Ticket size={13} /> Upload Coupon Codes
              </p>
              <textarea
                value={couponInput}
                onChange={e => setCouponInput(e.target.value)}
                placeholder="Paste coupon codes here&#10;One per line or comma separated&#10;e.g.&#10;ZOMATO50&#10;SWIGGY100&#10;FOOD200"
                className="w-full h-32 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono outline-none focus:border-blue-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1 mb-3">
                {couponInput.split(/[\n,]/).filter(c => c.trim()).length} code{couponInput.split(/[\n,]/).filter(c => c.trim()).length !== 1 ? 's' : ''} detected
              </p>
              <button onClick={handleUploadCoupons} disabled={savingCoupons || !couponInput.trim()}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {savingCoupons ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {savingCoupons ? 'Uploading...' : 'Upload Coupons'}
              </button>
            </div>

            {/* Coupon list */}
            {coupons.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">All Coupons ({coupons.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {coupons.map(coupon => (
                    <div key={coupon.id} className={`flex items-center justify-between p-2 rounded-lg ${coupon.is_used ? 'bg-slate-50' : 'bg-green-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${coupon.is_used ? 'text-slate-400 line-through' : 'text-green-700'}`}>{coupon.code}</span>
                        {coupon.is_used && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">USED</span>}
                      </div>
                      {!coupon.is_used && (
                        <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manually trigger winner */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Trophy size={13} /> Manually Pick Winner
              </p>
              <p className="text-xs text-slate-400 mb-3">Enter a vehicle ID to manually trigger or override winner selection for that journey.</p>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. BAN-CHE-0101"
                  value={contestVehicleId} onChange={e => { setContestVehicleId(e.target.value.toUpperCase()); setVehicleTravelers([]); }}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none focus:border-yellow-400" />
                <button onClick={handleSearchTravelers} disabled={searchingTravelers || !contestVehicleId.trim()}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 text-sm">
                  {searchingTravelers ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Find
                </button>
                <button onClick={handleTriggerWinner} disabled={!!triggeringWinner || !contestVehicleId.trim()}
                  className="px-4 py-2 bg-yellow-400 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 text-sm">
                  {triggeringWinner && vehicleTravelers.length === 0 ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                  Auto Pick
                </button>
              </div>
              
              {/* Traveler List for Manual Override */}
              {vehicleTravelers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-600 mb-2">Select a traveler to override and Crown as Winner:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {vehicleTravelers.map(t => (
                      <div key={t.user_id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-lg">
                        <span className="text-sm font-bold text-slate-700">{t.name}</span>
                        <button onClick={() => handlePickManualWinner(t.user_id)} disabled={!!triggeringWinner}
                          className="px-3 py-1.5 bg-yellow-100 text-yellow-600 hover:bg-yellow-400 hover:text-white transition-colors text-xs font-bold rounded-lg flex items-center gap-1">
                          {triggeringWinner === contestVehicleId ? <Loader2 size={12} className="animate-spin" /> : 'Crown'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Winners history */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Trophy size={13} className="text-yellow-500" /> Winners History
              </p>
              {winners.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><Trophy size={32} className="mx-auto mb-2 opacity-20" /><p className="text-xs">No winners yet</p></div>
              ) : (
                <div className="space-y-3">
                  {winners.map(winner => (
                    <div key={winner.id} className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-white font-black text-sm flex-shrink-0">🏆</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{winner.winner_name}</p>
                        <p className="text-xs text-slate-500 truncate">{winner.contest_type} • {winner.vehicle_id}</p>
                        <p className="text-xs text-slate-400">{new Date(winner.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-yellow-600">{winner.score} pts</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${winner.email_sent ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {winner.email_sent ? '✉️ Sent' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};