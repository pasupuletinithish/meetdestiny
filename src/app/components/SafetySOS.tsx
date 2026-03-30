import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, AlertTriangle, Shield, MapPin,
  Phone, Loader2, Users, X, CheckCircle, Radio, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';

interface SOSAlert {
  id: string;
  user_id: string;
  user_name: string;
  vehicle_id: string;
  latitude: number | null;
  longitude: number | null;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

interface CheckinData {
  id: string;
  user_id: string;
  name: string;
  vehicle_id: string;
}

export const SafetySOS: React.FC = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<SOSAlert[]>([]);
  const [myAlert, setMyAlert] = useState<SOSAlert | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<any>(null);
  const holdInterval = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setCurrentUserId(user.id);

      const { data: checkin } = await supabase
        .from('checkins').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!checkin) { navigate('/check-in'); return; }
      setCurrentCheckin(checkin);

      // Check for existing active SOS
      const { data: existingAlert } = await supabase
        .from('sos_alerts').select('*')
        .eq('user_id', user.id).eq('is_resolved', false).maybeSingle();
      if (existingAlert) { setMyAlert(existingAlert); setSosActive(true); }

      // Fetch active alerts on same vehicle
      const { data: alerts } = await supabase
        .from('sos_alerts').select('*')
        .eq('vehicle_id', checkin.vehicle_id).eq('is_resolved', false)
        .neq('user_id', user.id);
      setActiveAlerts(alerts || []);

      // Get location
      getLocation();
    };
    init();
  }, [navigate]);

  // Realtime SOS alerts
  useEffect(() => {
    if (!currentCheckin) return;
    const channel = supabase.channel('sos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts',
        filter: `vehicle_id=eq.${currentCheckin.vehicle_id}` },
        async () => {
          const { data: alerts } = await supabase
            .from('sos_alerts').select('*')
            .eq('vehicle_id', currentCheckin.vehicle_id).eq('is_resolved', false)
            .neq('user_id', currentUserId);
          setActiveAlerts(alerts || []);
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentCheckin, currentUserId]);

  // Load Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const loadLeaflet = async () => {
      // Load Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Load Leaflet JS
      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!mapRef.current) return;

      const defaultLat = location?.lat || 12.9716;
      const defaultLng = location?.lng || 77.5946;

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([defaultLat, defaultLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // User location marker
      if (location) {
        const userIcon = L.divIcon({
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#1E88E5;border:3px solid white;box-shadow:0 2px 8px rgba(30,136,229,0.4)"></div>`,
          className: '', iconSize: [16, 16], iconAnchor: [8, 8],
        });
        L.marker([location.lat, location.lng], { icon: userIcon })
          .addTo(map).bindPopup('You are here');

        // Search for nearby police and hospitals using Overpass API
        fetchNearbyPlaces(map, L, location.lat, location.lng);
      }

      leafletMapRef.current = map;
      setMapLoaded(true);
    };

    loadLeaflet();
  }, [location]);

  const fetchNearbyPlaces = async (map: any, L: any, lat: number, lng: number) => {
    try {
      const radius = 2000;
      const query = `[out:json][timeout:10];(node["amenity"="police"](around:${radius},${lat},${lng});node["amenity"="hospital"](around:${radius},${lat},${lng});node["amenity"="clinic"](around:${radius},${lat},${lng}););out body;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

      const response = await fetch(url);
      const data = await response.json();

      data.elements?.forEach((place: any) => {
        const isPolice = place.tags?.amenity === 'police';
        const color = isPolice ? '#ef4444' : '#FF6B35';
        const emoji = isPolice ? '🚔' : '🏥';

        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:8px;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px ${color}60;border:2px solid white">${emoji}</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });

        const name = place.tags?.name || (isPolice ? 'Police Station' : 'Hospital');
        L.marker([place.lat, place.lon], { icon })
          .addTo(map).bindPopup(`<strong>${name}</strong>`);
      });
    } catch (e) {
      console.log('Could not load nearby places');
    }
  };

  const getLocation = () => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        // Default to Bangalore if location denied
        setLocation({ lat: 12.9716, lng: 77.5946 });
        setLocationLoading(false);
        toast.info('Using default location — please enable GPS for accurate results');
      },
      { timeout: 8000 }
    );
  };

  // Hold-to-SOS logic
  const startHold = () => {
    if (sosActive) return;
    let progress = 0;
    holdInterval.current = setInterval(() => {
      progress += 4;
      setHoldProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(holdInterval.current);
        triggerSOS();
      }
    }, 120);
  };

  const endHold = () => {
    clearInterval(holdInterval.current);
    clearTimeout(holdTimer.current);
    setHoldProgress(0);
  };

  const triggerSOS = async () => {
    if (!currentCheckin || !currentUserId || sosLoading) return;
    setSosLoading(true);

    const { data, error } = await supabase.from('sos_alerts').insert({
      user_id: currentUserId,
      user_name: currentCheckin.name,
      vehicle_id: currentCheckin.vehicle_id,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      message: 'SOS — Need immediate help!',
      is_resolved: false,
    }).select().single();

   if (error) {
  toast.error('Failed to send SOS');
} else {
  setMyAlert(data);
  setSosActive(true);
  toast.error('🆘 SOS Alert sent to all travelers!', { duration: 5000 });

  // ← ADD THIS — notify all travelers on vehicle
  const { data: travelers } = await supabase
    .from('checkins').select('user_id')
    .eq('vehicle_id', currentCheckin.vehicle_id)
    .eq('is_active', true)
    .neq('user_id', currentUserId);

  travelers?.forEach(t => 
    notify.sos(t.user_id, currentCheckin.name, currentCheckin.vehicle_id)
  );
}
    setSosLoading(false);
  };

  const cancelSOS = async () => {
    if (!myAlert) return;
    const { error } = await supabase
      .from('sos_alerts').update({ is_resolved: true }).eq('id', myAlert.id);
    if (error) toast.error('Failed to cancel SOS');
    else {
      setSosActive(false);
      setMyAlert(null);
      setHoldProgress(0);
      toast.success('SOS cancelled — glad you\'re safe!');
    }
  };

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, padding: '14px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(239,68,68,0.1)', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/discovery')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#ef4444' }} />
          </motion.button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ef4444' }}>Safety SOS</h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Emergency assistance</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '5px 10px' }}>
            <Shield style={{ width: 12, height: 12, color: '#ef4444' }} />
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{currentCheckin?.vehicle_id}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 10 }}>

        {/* Active SOS alerts from others */}
        <AnimatePresence>
          {activeAlerts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              style={{ margin: '12px 16px 0', background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                  {activeAlerts.length} Active SOS on your vehicle
                </span>
              </div>
              {activeAlerts.map(alert => (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{alert.user_name}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{alert.message}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map */}
        <div style={{ margin: '12px 16px 0', borderRadius: 16, overflow: 'hidden', border: '1.5px solid rgba(30,136,229,0.12)', height: 220, position: 'relative' }}>
          {locationLoading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <Loader2 style={{ width: 24, height: 24, color: '#1E88E5', marginBottom: 8 }} className="animate-spin" />
              <span style={{ fontSize: 12, color: '#64748b' }}>Getting your location...</span>
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Map legend */}
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '6px 10px', zIndex: 1000, display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>🚔</span>
              <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>Police</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>🏥</span>
              <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>Hospital</span>
            </div>
          </div>
        </div>

        {/* SOS Button */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

          {!sosActive ? (
            <>
              <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>
                Hold the button for 3 seconds to send an SOS alert to all travelers on your vehicle.
              </p>

              {/* Hold-to-activate SOS button */}
              <div style={{ position: 'relative', width: 140, height: 140 }}>
                {/* Progress ring */}
                <svg width="140" height="140" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(239,68,68,0.1)" strokeWidth="6" />
                  <circle cx="70" cy="70" r="62" fill="none" stroke="#ef4444" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 62}`}
                    strokeDashoffset={2 * Math.PI * 62 * (1 - holdProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.1s' }} />
                </svg>

                <motion.button
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  disabled={sosLoading}
                  animate={{ scale: holdProgress > 0 ? [1, 0.95, 1] : 1 }}
                  transition={{ duration: 0.3, repeat: holdProgress > 0 ? Infinity : 0 }}
                  style={{
                    position: 'absolute', inset: 10, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: holdProgress > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    boxShadow: holdProgress > 0 ? '0 8px 32px rgba(239,68,68,0.4)' : '0 4px 16px rgba(239,68,68,0.15)',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }}>
                  {sosLoading
                    ? <Loader2 style={{ width: 28, height: 28, color: holdProgress > 0 ? '#fff' : '#ef4444' }} className="animate-spin" />
                    : <AlertTriangle style={{ width: 28, height: 28, color: holdProgress > 0 ? '#fff' : '#ef4444' }} />
                  }
                  <span style={{ fontSize: 11, fontWeight: 800, color: holdProgress > 0 ? '#fff' : '#ef4444', letterSpacing: '0.08em' }}>
                    {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'HOLD'}
                  </span>
                </motion.button>
              </div>

              <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                Hold for 3 seconds to activate
              </p>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{ width: '100%', background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <AlertTriangle style={{ width: 26, height: 26, color: '#ef4444' }} />
              </motion.div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', margin: '0 0 6px' }}>SOS Active</h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                All travelers on {currentCheckin?.vehicle_id} have been alerted. Help is on the way.
              </p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={cancelSOS}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <CheckCircle style={{ width: 16, height: 16, color: '#16a34a' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>I'm Safe — Cancel SOS</span>
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Safety tips */}
        <div style={{ margin: '0 16px 24px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '13px 14px', backdropFilter: 'blur(12px)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Safety Tips</p>
          {[
            { icon: '📍', text: 'Note your current stop name and vehicle number' },
            { icon: '📞', text: 'Call 112 for immediate police emergency in India' },
            { icon: '🏥', text: 'Dial 108 for ambulance services in India' },
            { icon: '👥', text: 'Stay with other travelers if possible' },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{tip.icon}</span>
              <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.5 }}>{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(30,136,229,0.08)', padding: '8px 0 max(12px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-around', position: 'relative', zIndex: 20 }}>
        {[
          { icon: <Radio style={{ width: 22, height: 22 }} />, label: 'Discover', action: () => navigate('/discovery') },
          { icon: <MessageCircle style={{ width: 22, height: 22 }} />, label: 'Lounge', action: () => navigate('/lounge') },
          { icon: <Users style={{ width: 22, height: 22 }} />, label: 'Friends', action: () => navigate('/friends') },
          { icon: <Shield style={{ width: 22, height: 22 }} />, label: 'Safety', action: () => {} },
        ].map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.88 }} onClick={item.action}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 16px', color: item.label === 'Safety' ? '#ef4444' : '#94a3b8' }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: item.label === 'Safety' ? 700 : 400 }}>{item.label}</span>
            {item.label === 'Safety' && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', marginTop: -1 }} />}
          </motion.button>
        ))}
      </div>
    </div>
  );
};