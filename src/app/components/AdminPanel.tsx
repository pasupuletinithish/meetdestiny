import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Search, LogOut, Loader2, Download, ShieldAlert, ShieldCheck, Users, Flag, CheckCircle, XCircle, Clock } from 'lucide-react';
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

  // Departure times
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
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'add' | 'users' | 'reports'>('list');
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editForwardDep, setEditForwardDep] = useState('');
  const [editReturnDep, setEditReturnDep] = useState('');

  const [form, setForm] = useState({
    operator: '',
    from_location: '',
    to_location: '',
    vehicle_type: 'bus',
    count: 5,
    forward_departure: '',
    return_departure: '',
  });

  useEffect(() => {
    const init = async () => {
      await fetchVehicles();
      await fetchUsers();
      await fetchReports();
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
        const { data: reporter } = await supabase.from('user_profiles').select('name').eq('user_id', r.reporter_id).maybeSingle();
        const { data: reported } = await supabase.from('user_profiles').select('name').eq('user_id', r.reported_id).maybeSingle();
        return { ...r, reporter: reporter || { name: 'Unknown' }, reported: reported || { name: 'Unknown' } };
      }));
      setReports(enriched);
    }
  };

  const handleBan = async (userId: string, userName: string) => {
    setActionLoading(userId);
    const { error } = await supabase.from('user_profiles').update({ is_banned: true, warn_count: 2 }).eq('id', userId);
    if (!error) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: true } : u)); toast.error(`${userName} has been banned.`); }
    else toast.error('Failed to ban user');
    setActionLoading(null);
  };

  const handleUnban = async (userId: string, userName: string) => {
    setActionLoading(userId);
    const { data, error } = await supabase.from('user_profiles').update({ is_banned: false, warn_count: 0 }).eq('id', userId).select();
    if (!error && data?.length > 0) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: false, warn_count: 0 } : u)); toast.success(`${userName} has been unbanned! ✅`); }
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
    // Find next available number for this route
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
      // Store as text for display, actual time columns
      departure_time: form.forward_departure || '00:00',
      arrival_time: '23:59',
      forward_departure: form.forward_departure || null,
      return_departure: form.return_departure || null,
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

  // Save departure times to existing vehicle
  const handleSaveDepartureTimes = async (vehicleId: string) => {
    const { error } = await supabase.from('vehicles').update({
      forward_departure: editForwardDep || null,
      return_departure: editReturnDep || null,
      departure_time: editForwardDep || '00:00',
    }).eq('id', vehicleId);
    if (!error) { toast.success('Departure times saved! ✅'); setEditingVehicleId(null); fetchVehicles(); }
    else toast.error('Failed to save');
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.profession?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingReports = reports.filter(r => r.status === 'pending');
  const bannedCount = users.filter(u => u.is_banned).length;
  const warnedCount = users.filter(u => u.warn_count > 0 && !u.is_banned).length;
  const filteredVehicles = vehicles.filter(v =>
    v.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.operator?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.from_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.to_location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto h-screen flex flex-col bg-slate-50 font-sans shadow-2xl">

      {/* ── Header ── */}
      <div className="bg-blue-600 p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-black italic">DESTINY ADMIN</h1>
          <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-lg"><LogOut size={18} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-lg font-black">{users.length}</p><p className="text-xs opacity-70">Users</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-lg font-black text-red-300">{bannedCount}</p><p className="text-xs opacity-70">Banned</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-lg font-black text-yellow-300">{pendingReports.length}</p><p className="text-xs opacity-70">Reports</p></div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: 'list', label: 'BUSES' },
            { id: 'add', label: 'ADD' },
            { id: 'users', label: 'USERS' },
            { id: 'reports', label: `REPORTS${pendingReports.length > 0 ? ` (${pendingReports.length})` : ''}` },
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

                  {/* Departure times display */}
                  {(v.forward_departure || v.return_departure) ? (
                    <div className="flex gap-2 mb-2">
                      {v.forward_departure && (
                        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1">
                          <span className="text-xs">→</span>
                          <span className="text-xs font-bold text-blue-600">{v.from_location?.slice(0,3)}: {v.forward_departure}</span>
                        </div>
                      )}
                      {v.return_departure && (
                        <div className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-2 py-1">
                          <span className="text-xs">←</span>
                          <span className="text-xs font-bold text-orange-600">{v.to_location?.slice(0,3)}: {v.return_departure}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300 mb-2 italic">No departure times set</div>
                  )}

                  {/* Edit departure times */}
                  {editingVehicleId === v.id ? (
                    <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-600 flex items-center gap-1"><Clock size={12} /> Set Departure Times</p>
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
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveDepartureTimes(v.id)} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">Save Times</button>
                        <button onClick={() => setEditingVehicleId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingVehicleId(v.id); setEditForwardDep(v.forward_departure || ''); setEditReturnDep(v.return_departure || ''); }}
                      className="w-full py-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-all">
                      <Clock size={11} className="inline mr-1" />
                      {v.forward_departure || v.return_departure ? 'Edit departure times' : 'Add departure times'}
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
              <p>Generate IDs like <span className="font-mono font-bold">BAN-CHE-0101</span> for Bangalore↔Chennai buses. Each ID is permanent for that physical bus. Set departure times for both directions!</p>
            </div>

            <input placeholder="Operator Name (e.g. KSRTC, NueGo)"
              className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-sm"
              value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })} />

            <div className="flex gap-2">
              <input placeholder="From City" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none text-sm"
                value={form.from_location} onChange={e => setForm({ ...form, from_location: e.target.value })} />
              <input placeholder="To City" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none text-sm"
                value={form.to_location} onChange={e => setForm({ ...form, to_location: e.target.value })} />
            </div>

            {/* ── DEPARTURE TIMES ── */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5"><Clock size={13} /> Departure Times (Both Directions)</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">
                    → <span className="font-semibold">{form.from_location || 'Origin'}</span> departure time
                  </label>
                  <input type="time" value={form.forward_departure}
                    onChange={e => setForm({ ...form, forward_departure: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">
                    ← <span className="font-semibold">{form.to_location || 'Destination'}</span> departure time (return)
                  </label>
                  <input type="time" value={form.return_departure}
                    onChange={e => setForm({ ...form, return_departure: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400">💡 These times apply to all buses on this route. Can be edited per bus later.</p>
            </div>

            {/* ID preview */}
            {form.from_location && form.to_location && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-bold">ID format: <span className="font-mono">{generateRoutePrefix(form.from_location, form.to_location)}-0101</span></p>
              </div>
            )}

            {/* Count slider */}
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs font-bold text-blue-600 mb-2 uppercase">Quantity: {form.count}</p>
              <input type="range" min="1" max="20" value={form.count} className="w-full accent-blue-600"
                onChange={e => setForm({ ...form, count: parseInt(e.target.value) })} />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1</span><span>20</span></div>
            </div>

            {/* Vehicle type */}
            <div className="flex gap-2">
              {['bus', 'mini-bus', 'sleeper', 'ac-sleeper'].map(type => (
                <button key={type} type="button" onClick={() => setForm({ ...form, vehicle_type: type })}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${form.vehicle_type === type ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {type}
                </button>
              ))}
            </div>

            <button onClick={handlePreview} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl">
              Preview IDs
            </button>

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
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleUnban(user.id, user.name)} className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl shadow-sm">
                            <ShieldCheck size={14} />Unban
                          </motion.button>
                        ) : (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleBan(user.id, user.name)} className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl shadow-sm">
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
              <div className="text-center py-12 text-slate-400"><Flag size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No reports yet</p></div>
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
      </div>
    </div>
  );
};