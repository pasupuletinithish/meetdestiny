import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Search, LogOut, Check, Loader2, Download, Trash2, Edit2, X } from 'lucide-react';
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
  stops: string[];
  bus_plate?: string;
  created_at: string;
}

// Helper: Generate route-based ID prefix
function generateRoutePrefix(from: string, to: string): string {
  const clean = (s: string) => s.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return `${clean(from)}-${clean(to)}`;
}

// Helper: Generate sequential IDs
function generateBulkIds(from: string, to: string, count: number, startFrom: number): string[] {
  const prefix = generateRoutePrefix(from, to);
  return Array.from({ length: count }, (_, i) => {
    const num = String(startFrom + i).padStart(4, '0');
    return `${prefix}-${num}`;
  });
}

// Helper: Generate QR code URL
function getQRUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=1E88E5&margin=2`;
}

// --- PREMIUM FLYER GENERATOR ---
async function downloadFlyer(vehicle: Vehicle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; // High Resolution
  canvas.height = 1800;
  const ctx = canvas.getContext('2d')!;

  // 1. Load QR Code First (Critical Fix)
  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  const qrLoadPromise = new Promise((resolve) => {
    qrImg.onload = () => resolve(true);
    qrImg.onerror = () => resolve(false);
    qrImg.src = getQRUrl(vehicle.vehicle_number);
  });

  await qrLoadPromise;

  // 2. Background - Premium Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1800);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 1800);

  // 3. Top Header Card
  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.roundRect(0, 0, 1200, 450, [0, 0, 80, 80]);
  ctx.fill();

  // App Logo/Name
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 90px sans-serif';
  ctx.fillText('DESTINY', 600, 180);
  
  ctx.font = '34px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('NETWORK • CONNECT • TRAVEL', 600, 240);

  // 4. Route Badge (Glassmorphism look)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.roundRect(150, 290, 900, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(`${vehicle.from_location.toUpperCase()}  →  ${vehicle.to_location.toUpperCase()}`, 600, 355);

  // 5. White Main Card
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 50;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(150, 480, 900, 1150, 60);
  ctx.fill();
  ctx.shadowBlur = 0; // Reset shadow

  // 6. Operator Info
  ctx.fillStyle = '#FF6B35';
  ctx.beginPath();
  ctx.roundRect(450, 520, 300, 60, 30);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(vehicle.operator, 600, 560);

  // 7. QR Code Rendering
  if (qrImg.complete) {
    ctx.drawImage(qrImg, 350, 650, 500, 500);
  }

  // 8. Visual Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(250, 1220);
  ctx.lineTo(950, 1220);
  ctx.stroke();

  // 9. Premium ID Box
  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.roundRect(250, 1300, 700, 150, 30);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px monospace';
  ctx.fillText(vehicle.vehicle_number, 600, 1400);

  // 10. Footer Instructions
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('Scan to join the Lounge', 600, 1520);
  
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Connect with verified co-travelers instantly.', 600, 1570);

  // 11. Final Branding
  ctx.fillStyle = '#1E88E5';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('destiny.app • Your paths were meant to meet', 600, 1750);

  // Download Trigger
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'add'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBusPlate, setEditBusPlate] = useState('');
  const [previewIds, setPreviewIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    operator: '',
    from_location: '',
    to_location: '',
    vehicle_type: 'bus',
    count: 5,
  });

  useEffect(() => {
    fetchVehicles().then(() => setLoading(false));
  }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setVehicles(data || []);
  };

  const handlePreview = () => {
    if (!form.operator || !form.from_location || !form.to_location) {
      toast.error('Missing route details');
      return;
    }
    const ids = generateBulkIds(form.from_location, form.to_location, form.count, 101); // Starting sequence
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
      departure_time: '00:00',
      arrival_time: '23:59',
      stops: [],
    }));

    const { error } = await supabase.from('vehicles').insert(rows);
    if (!error) {
      toast.success('Buses registered!');
      setActiveView('list');
      fetchVehicles();
    }
    setSaving(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-lg mx-auto h-screen flex flex-col bg-slate-50 font-sans shadow-2xl">
      {/* Premium Header */}
      <div className="bg-blue-600 p-6 text-white">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black italic">DESTINY ADMIN</h1>
          <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-lg"><LogOut size={18}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveView('list')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${activeView === 'list' ? 'bg-white text-blue-600' : 'bg-white/10'}`}>ALL BUSES</button>
          <button onClick={() => setActiveView('add')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${activeView === 'add' ? 'bg-white text-blue-600' : 'bg-white/10'}`}>+ REGISTER</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeView === 'list' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
              <input 
                className="w-full p-3 pl-10 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500" 
                placeholder="Search route or ID..."
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {vehicles.filter(v => v.vehicle_number.includes(searchQuery)).map(v => (
              <div key={v.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-blue-600 font-mono font-bold text-lg">{v.vehicle_number}</div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">{v.from_location} → {v.to_location}</div>
                </div>
                <button onClick={() => downloadFlyer(v)} className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Download size={20}/></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 bg-white p-6 rounded-3xl shadow-sm">
            <h2 className="font-bold text-slate-800">Bulk Registration</h2>
            <input placeholder="Operator Name" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" onChange={e => setForm({...form, operator: e.target.value})}/>
            <div className="flex gap-2">
              <input placeholder="From" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none" onChange={e => setForm({...form, from_location: e.target.value})}/>
              <input placeholder="To" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none" onChange={e => setForm({...form, to_location: e.target.value})}/>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl">
                <p className="text-xs font-bold text-blue-600 mb-2 uppercase">Quantity: {form.count}</p>
                <input type="range" min="1" max="20" className="w-full accent-blue-600" onChange={e => setForm({...form, count: parseInt(e.target.value)})}/>
            </div>
            <button onClick={handlePreview} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl">Preview IDs</button>
            
            {previewIds.length > 0 && (
              <div className="pt-4 border-t space-y-4">
                <div className="flex flex-wrap gap-2">
                  {previewIds.map(id => <span key={id} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-mono">{id}</span>)}
                </div>
                <button onClick={handleSaveBulk} disabled={saving} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl shadow-lg shadow-green-200">
                   {saving ? 'Registering...' : `Confirm & Save ${previewIds.length} Buses`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};