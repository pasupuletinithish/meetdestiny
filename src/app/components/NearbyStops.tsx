import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, MapPin, Users, Check, Loader2,
  Radio, MessageCircle, User as UserIcon, Navigation, Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { BottomNav } from './BottomNav';

interface StopData {
  name: string;
  travelers: { id: string; user_id: string; name: string; profession: string; get_off_stop: string }[];
  isDestination?: boolean;
  isPassed?: boolean;
  isGetOffStop?: boolean;
}

interface CheckinData {
  id: string;
  user_id: string;
  name: string;
  vehicle_id: string;
  from_location: string;
  to_location: string;
  get_off_stop: string | null;
}

interface VehicleData {
  stops: string[];
  from_location: string;
  to_location: string;
  vehicle_number: string;
}

export const NearbyStops: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentCheckin, setCurrentCheckin] = useState<CheckinData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [stops, setStops] = useState<StopData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [savingStop, setSavingStop] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  const buildStops = useCallback((
    vehicle: VehicleData,
    checkin: CheckinData,
    allCheckins: any[],
    userId: string
  ) => {
    const allStops = [vehicle.from_location, ...vehicle.stops, vehicle.to_location];

    const stopsData: StopData[] = allStops.map((stopName, index) => {
      const travelers = allCheckins.filter(c =>
        c.user_id !== userId &&
        (c.get_off_stop === stopName || (index === allStops.length - 1 && !c.get_off_stop))
      );

      return {
        name: stopName,
        travelers,
        isDestination: index === allStops.length - 1,
        isPassed: index === 0,
        isGetOffStop: checkin.get_off_stop === stopName,
      };
    });

    setStops(stopsData);
  }, []);

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
      setSelectedStop(checkin.get_off_stop);

      // Fetch vehicle data
      const { data: vehicle } = await supabase
        .from('vehicles').select('*')
        .ilike('vehicle_number', checkin.vehicle_id).maybeSingle();

      if (vehicle) {
        setVehicleData(vehicle);

        // Fetch all checkins on this vehicle
        const { data: allCheckins } = await supabase
          .from('checkins').select('*')
          .eq('vehicle_id', checkin.vehicle_id)
          .eq('is_active', true);

        buildStops(vehicle, checkin, allCheckins || [], user.id);
      } else {
        // Fallback if vehicle not in DB (e.g. PNR train)
        const fallbackStops: StopData[] = [
          { name: checkin.from_location, travelers: [], isPassed: true },
          { name: checkin.to_location, travelers: [], isDestination: true },
        ];
        setStops(fallbackStops);
      }

      setLoading(false);
    };
    init();
  }, [navigate, buildStops]);

  const handleMarkGetOffStop = async (stopName: string) => {
    if (!currentCheckin || savingStop) return;
    setSavingStop(true);

    const newStop = selectedStop === stopName ? null : stopName;

    const { error } = await supabase
      .from('checkins').update({ get_off_stop: newStop }).eq('id', currentCheckin.id);

    if (error) {
      toast.error('Failed to update stop');
    } else {
      setSelectedStop(newStop);
      toast.success(newStop ? `Get-off stop set to ${newStop}!` : 'Get-off stop cleared');

      // Rebuild stops
      if (vehicleData && currentUserId) {
        const { data: allCheckins } = await supabase
          .from('checkins').select('*')
          .eq('vehicle_id', currentCheckin.vehicle_id).eq('is_active', true);
        buildStops(vehicleData, { ...currentCheckin, get_off_stop: newStop }, allCheckins || [], currentUserId);
      }
    }
    setSavingStop(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E3F2FD 0%, #ffffff 50%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#1E88E5' }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)',
      fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative',
    }}>

      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div style={{ position: 'absolute', width: 280, height: 280, top: '-8%', left: '-15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,136,229,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div style={{ position: 'absolute', width: 240, height: 240, bottom: '-6%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, padding: '16px 20px 14px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,136,229,0.08)', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/discovery')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#1E88E5' }} />
          </motion.button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #1E88E5, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Nearby Stops
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{currentCheckin?.vehicle_id} • {stops.length} stops</p>
          </div>
          <div style={{ background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', borderRadius: 10, padding: '5px 10px' }}>
            <span style={{ fontSize: 11, color: '#1E88E5', fontWeight: 600 }}>
              {currentCheckin?.from_location} → {currentCheckin?.to_location}
            </span>
          </div>
        </div>

        {/* Get-off stop info */}
        {selectedStop && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Getting off at: {selectedStop}</span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMarkGetOffStop(selectedStop)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8' }}>
              Clear
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* ── STOPS LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', scrollbarWidth: 'none', position: 'relative', zIndex: 10 }}>

        {/* Instructions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(30,136,229,0.05)', border: '1px solid rgba(30,136,229,0.1)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin style={{ width: 14, height: 14, color: '#1E88E5', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.4 }}>
            Tap a stop to mark where you're getting off. See how many travelers are at each stop.
          </p>
        </motion.div>

        {/* Timeline */}
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'linear-gradient(to bottom, #1E88E5, #FF6B35)', borderRadius: 2, opacity: 0.3 }} />

          {stops.map((stop, index) => {
            const isSelected = selectedStop === stop.name;
            const isFirst = index === 0;
            const isLast = index === stops.length - 1;
            const hasTravelers = stop.travelers.length > 0;
            const isExpanded = expandedStop === stop.name;

            return (
              <motion.div key={stop.name}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                style={{ display: 'flex', gap: 14, marginBottom: index < stops.length - 1 ? 4 : 0 }}>

                {/* Stop dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    onClick={() => !isFirst && !isLast && handleMarkGetOffStop(stop.name)}
                    style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? 'linear-gradient(135deg, #22c55e, #16a34a)' : isFirst ? 'linear-gradient(135deg, #1E88E5, #1565C0)' : isLast ? 'linear-gradient(135deg, #FF6B35, #E85A2B)' : 'rgba(255,255,255,0.9)',
                      border: `2px solid ${isSelected ? '#16a34a' : isFirst ? '#1E88E5' : isLast ? '#FF6B35' : 'rgba(30,136,229,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: !isFirst && !isLast ? 'pointer' : 'default',
                      boxShadow: isSelected ? '0 4px 12px rgba(34,197,94,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s',
                      zIndex: 1,
                    }}>
                    {savingStop && isSelected
                      ? <Loader2 style={{ width: 14, height: 14, color: '#fff' }} className="animate-spin" />
                      : isSelected ? <Check style={{ width: 16, height: 16, color: '#fff' }} />
                      : isFirst ? <Navigation style={{ width: 15, height: 15, color: '#fff' }} />
                      : isLast ? <MapPin style={{ width: 15, height: 15, color: '#fff' }} />
                      : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1E88E5', opacity: 0.5 }} />
                    }
                  </motion.div>
                </div>

                {/* Stop card */}
                <div style={{ flex: 1, marginBottom: 12 }}>
                  <motion.div
                    onClick={() => hasTravelers && setExpandedStop(isExpanded ? null : stop.name)}
                    style={{
                      background: isSelected ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.8)',
                      border: `1.5px solid ${isSelected ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.95)'}`,
                      borderRadius: 14, padding: '11px 14px',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      cursor: hasTravelers ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{stop.name}</p>
                          {isFirst && <span style={{ fontSize: 9, background: 'rgba(30,136,229,0.12)', color: '#1E88E5', padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>START</span>}
                          {isLast && <span style={{ fontSize: 9, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>END</span>}
                          {isSelected && <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>YOUR STOP</span>}
                        </div>
                        {!isFirst && !isLast && (
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Tap dot to mark as your stop</p>
                        )}
                      </div>

                      {hasTravelers && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(30,136,229,0.08)', border: '1px solid rgba(30,136,229,0.15)', borderRadius: 20, padding: '4px 10px' }}>
                          <Users style={{ width: 12, height: 12, color: '#1E88E5' }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E88E5' }}>{stop.travelers.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded travelers list */}
                    <AnimatePresence>
                      {isExpanded && hasTravelers && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden', marginTop: 10, borderTop: '1px solid rgba(30,136,229,0.1)', paddingTop: 10 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stop.travelers.map(traveler => {
                              const initials = traveler.name.split(' ').map((n: string) => n[0]).join('');
                              return (
                                <div key={traveler.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</span>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{traveler.name}</p>
                                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{traveler.profession}</p>
                                  </div>
                                  <motion.button whileTap={{ scale: 0.9 }}
                                    onClick={() => navigate('/lounge/private', { state: { traveler } })}
                                    style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(30,136,229,0.1)', border: '1px solid rgba(30,136,229,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageCircle style={{ width: 13, height: 13, color: '#1E88E5' }} />
                                  </motion.button>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <BottomNav activeTab="" />
    </div>
  );
};