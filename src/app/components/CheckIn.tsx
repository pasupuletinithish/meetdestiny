/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { MapPin, Briefcase, Bus, Train, Search, Loader2, Navigation, Clock, Route, ShieldCheck, ShieldAlert, Timer, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { WaitingGame } from './WaitingGame';
import { AdSlot } from './AdSlot';
import { LiveVehicleStatus } from './LiveVehicleStatus';

type TabType = 'reserved-train' | 'reserved-bus' | 'route-match';

interface RouteAnalysis {
  isValid: boolean;
  estimatedDurationMinutes: number;
  estimatedTime: string;
  distance: string;
  highway: string;
  majorStops: string[];
  corridor: string[];
}

interface GPSResult {
  lat: number;
  lng: number;
  accuracy: number;
}

const parseTimeToDate = (timeStr: string, dateStr?: string): Date | null => {
  try {
    let hours = 0, minutes = 0;
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const [time, period] = timeStr.trim().split(' ');
      const [h, m] = time.split(':').map(Number);
      hours = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
      minutes = m;
    } else {
      const [h, m] = timeStr.split(':').map(Number);
      hours = h; minutes = m;
    }
    let base = new Date();
    if (dateStr) { const parsed = new Date(dateStr.replace(/-/g, ' ')); if (!isNaN(parsed.getTime())) base = parsed; }
    base.setHours(hours, minutes, 0, 0);
    return base;
  } catch { return null; }
};

// ── FIXED: Correct check-in window logic ─────────────────────
// canCheckIn = true when within 10 mins before departure OR during journey
// tooLate = true when past arrival time
// too early = more than 10 mins before departure
const checkDepartureTime = (departureTime: Date, arrivalTime?: Date): { canCheckIn: boolean; minutesUntil: number; tooLate: boolean } => {
  const now = new Date();
  const diffMs = departureTime.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // Journey already ended — past arrival time
  const pastArrival = arrivalTime ? now > arrivalTime : false;
  if (pastArrival) {
    return { canCheckIn: false, minutesUntil: diffMins, tooLate: true };
  }

  // Too early — more than 10 mins before departure
  if (diffMins > 10) {
    return { canCheckIn: false, minutesUntil: diffMins, tooLate: false };
  }

  // ✅ Within window: 10 mins before OR during journey (diffMins is 0 or negative)
  return { canCheckIn: true, minutesUntil: diffMins, tooLate: false };
};

const calculateExpiryFromArrival = (arrivalTimeStr: string, dateStr?: string, fallbackDurationMinutes?: number): string => {
  const arrDate = parseTimeToDate(arrivalTimeStr, dateStr);
  if (arrDate) {
    const now = new Date();
    if (arrDate < now) { const fb = new Date(); fb.setMinutes(fb.getMinutes() + (fallbackDurationMinutes || 360) + 60); return fb.toISOString(); }
    arrDate.setMinutes(arrDate.getMinutes() + 60);
    return arrDate.toISOString();
  }
  const now = new Date(); now.setMinutes(now.getMinutes() + (fallbackDurationMinutes || 360) + 60); return now.toISOString();
};

const calculateExpiryFromDuration = (durationMinutes: number, departureTimeStr?: string): string => {
  const now = new Date();
  let baseDate = new Date(now);

  if (departureTimeStr) {
    const depDate = parseTimeToDate(departureTimeStr);
    if (depDate) {
      if (depDate.getTime() - now.getTime() > 12 * 60 * 60 * 1000) {
        depDate.setDate(depDate.getDate() - 1);
      }
      baseDate = depDate;
    }
  }

  const expDate = new Date(baseDate);
  expDate.setMinutes(expDate.getMinutes() + durationMinutes + 60);

  if (expDate < now) {
    const fallback = new Date(now);
    fallback.setMinutes(fallback.getMinutes() + durationMinutes + 60);
    return fallback.toISOString();
  }

  return expDate.toISOString();
};

const getCurrentLocation = (): Promise<GPSResult | null> => new Promise(resolve => {
  if (!navigator.geolocation) { resolve(null); return; }
  navigator.geolocation.getCurrentPosition(pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }), () => resolve(null), { timeout: 8000, maximumAge: 60000 });
});

const verifyLocationWithAI = async (lat: number, lng: number, from: string, to: string) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Route: ${from} to ${to} in India. Is this person near this route? Reply ONLY with JSON: {"isOnRoute": true, "nearestCity": "city name", "confidence": "high"}` }], temperature: 0.1, max_tokens: 60 }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { isOnRoute: true, nearestCity: 'Unknown', confidence: 'low' };
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch { return { isOnRoute: true, nearestCity: 'Unknown', confidence: 'low' }; }
};

const getAIDuration = async (from: string, to: string): Promise<number> => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: 'You are an Indian transport expert. Return ONLY a plain integer representing realistic road travel time in minutes. No text, no JSON, just the number.' }, { role: 'user', content: `Realistic road travel time in minutes from "${from}" to "${to}" in India. Return ONLY the integer.` }], temperature: 0.1, max_tokens: 10 }),
    });
    const data = await response.json();
    const minutes = parseInt(data.choices?.[0]?.message?.content?.trim());
    return isNaN(minutes) ? 360 : minutes;
  } catch { return 360; }
};

const analyzeRouteWithAI = async (from: string, to: string): Promise<RouteAnalysis | null> => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: 'You are an Indian geography and transport expert. Respond ONLY with raw JSON, no markdown, no explanation.' }, { role: 'user', content: `Analyze the travel route from "${from}" to "${to}" in India.\nReturn ONLY this exact JSON:\n{\n  "isValid": true,\n  "estimatedDurationMinutes": 390,\n  "estimatedTime": "6 hrs 30 mins",\n  "distance": "350 km",\n  "highway": "NH-48",\n  "majorStops": ["Vellore", "Krishnagiri", "Hosur"],\n  "corridor": ["${from}", "Vellore", "Krishnagiri", "Hosur", "${to}"]\n}` }], temperature: 0.1, max_tokens: 400 }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content.replace(/```json|```/g, '').trim()) as RouteAnalysis;
  } catch { return null; }
};

const findCorridorMatches = async (corridor: string[]): Promise<number> => {
  try {
    const orConditions = corridor.flatMap(stop => [`from_location.ilike.%${stop}%`, `to_location.ilike.%${stop}%`]).join(',');
    const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).or(orConditions).eq('is_active', true).gt('expires_at', new Date().toISOString());
    return count || 0;
  } catch { return 0; }
};

const getUserAvatar = async (userId: string): Promise<string> => {
  try { const { data } = await supabase.from('user_profiles').select('avatar_url').eq('user_id', userId).maybeSingle(); return data?.avatar_url || ''; } catch { return ''; }
};

const createGroupRoom = async (vehicleId: string) => {
  const { count } = await supabase.from('lounge_messages').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId);
  if (count === 0) {
    await supabase.from('lounge_messages').insert({ user_id: null, name: '🚌 MeetDestiny', profession: 'Travel Companion', text: `Welcome to ${vehicleId} group! 👋 Connect with your fellow travelers.`, vehicle_id: vehicleId, avatar_url: '', is_flagged: false, is_ai: true });
  }
};

function CompassLogo() {
  return (
    <svg width="56" height="56" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7F77DD" /><stop offset="100%" stopColor="#D4537E" /></linearGradient>
        <linearGradient id="cl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#534AB7" /><stop offset="100%" stopColor="#993556" /></linearGradient>
        <linearGradient id="cl3" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#993556" /><stop offset="100%" stopColor="#D4537E" /></linearGradient>
        <linearGradient id="cl4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#AFA9EC" /><stop offset="100%" stopColor="#ED93B1" /></linearGradient>
      </defs>
      <g transform="translate(200,200)">
        <circle cx="0" cy="0" r="148" fill="none" stroke="url(#cl1)" strokeWidth="0.5" opacity="0.12" />
        <circle cx="0" cy="0" r="116" fill="none" stroke="url(#cl2)" strokeWidth="1" opacity="0.25" />
        <g stroke="url(#cl1)" strokeLinecap="round" opacity="0.5" strokeWidth="1.5">
          <line x1="0" y1="-116" x2="0" y2="-100" /><line x1="0" y1="100" x2="0" y2="116" />
          <line x1="-116" y1="0" x2="-100" y2="0" /><line x1="100" y1="0" x2="116" y2="0" />
        </g>
        <circle cx="0" cy="0" r="96" fill="none" stroke="url(#cl2)" strokeWidth="1.8" opacity="0.6" />
        <text fontFamily="sans-serif" fontSize="15" fontWeight="600" fill="url(#cl3)" x="0" y="-104" textAnchor="middle" dominantBaseline="central">N</text>
        <path d="M0 -92 L11 0 L0 16 L-11 0Z" fill="url(#cl3)" />
        <path d="M0 92 L6 0 L0 -16 L-6 0Z" fill="url(#cl4)" opacity="0.3" />
        <circle cx="0" cy="0" r="36" fill="white" stroke="url(#cl2)" strokeWidth="2" />
        <circle cx="-10" cy="-11" r="8" fill="#534AB7" />
        <path d="M-20 4 Q-10 14 0 4" fill="#534AB7" />
        <circle cx="10" cy="-11" r="8" fill="#D4537E" />
        <path d="M0 4 Q10 14 20 4" fill="#D4537E" />
        <circle cx="0" cy="-4" r="3.5" fill="white" opacity="0.9" />
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
  const [userAvatar, setUserAvatar] = useState('');
  const [profession, setProfession] = useState('');

  // Waiting game
  const [showWaitingGame, setShowWaitingGame] = useState(false);
  const [waitingMinutes, setWaitingMinutes] = useState(0);

  // GPS
  const [gpsResult, setGpsResult] = useState<GPSResult | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'fetching' | 'verified' | 'warning' | 'skipped'>('idle');
  const [gpsMessage, setGpsMessage] = useState('');

  // Departure check
  const [departureCheck, setDepartureCheck] = useState<{ canCheckIn: boolean; minutesUntil: number; tooLate: boolean } | null>(null);
  const [countdown, setCountdown] = useState('');

  // Train
  const [pnr, setPnr] = useState('');
  const [pnrData, setPnrData] = useState<any>(null);
  const [trainAIDuration, setTrainAIDuration] = useState<number | null>(null);
  const [fetchingTrainDuration, setFetchingTrainDuration] = useState(false);

  // Bus
  const [busIdInput, setBusIdInput] = useState('');
  const [busData, setBusData] = useState<any>(null);
  const [busNotFound, setBusNotFound] = useState(false);
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualOperator, setManualOperator] = useState('');
  const [busAIDuration, setBusAIDuration] = useState<number | null>(null);
  const [fetchingBusDuration, setFetchingBusDuration] = useState(false);
  const [boardingDirection, setBoardingDirection] = useState<'forward' | 'return' | null>(null);

  // Route Match
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [corridorMatches, setCorridorMatches] = useState<number>(0);
  const [analyzingRoute, setAnalyzingRoute] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (user.user_metadata?.full_name) setUserName(user.user_metadata.full_name);
      const avatar = await getUserAvatar(user.id);
      setUserAvatar(avatar || user.user_metadata?.avatar_url || '');
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!departureCheck || departureCheck.canCheckIn || departureCheck.minutesUntil <= 0) return;
    const interval = setInterval(() => {
      const totalMins = departureCheck.minutesUntil - 10;
      if (totalMins <= 0) { setCountdown('now'); return; }
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [departureCheck]);

  // ── FIXED: Bus departure check with overnight support ─────
  const checkBusDeparture = useCallback((bus: any, direction: 'forward' | 'return') => {
    const depTimeStr = direction === 'forward'
      ? (bus.forward_departure || bus.departure_time)
      : (bus.return_departure || bus.departure_time);
    if (!depTimeStr) { setDepartureCheck({ canCheckIn: true, minutesUntil: 0, tooLate: false }); return; }
    const depDate = parseTimeToDate(depTimeStr);
    if (!depDate) { setDepartureCheck({ canCheckIn: true, minutesUntil: 0, tooLate: false }); return; }
    const arrDate = bus.arrival_time ? parseTimeToDate(bus.arrival_time) : undefined;
    // Fix overnight: if arrival appears before departure, add 1 day
    if (arrDate && arrDate < depDate) arrDate.setDate(arrDate.getDate() + 1);
    const check = checkDepartureTime(depDate, arrDate || undefined);
    setDepartureCheck(check);
    if (check.tooLate) {
      toast.error('❌ This bus has already completed its journey!');
    } else if (!check.canCheckIn) {
      const minsUntilOpen = check.minutesUntil - 10;
      const h = Math.floor(minsUntilOpen / 60); const m = minsUntilOpen % 60;
      toast.warning(`⏰ Too early! Check-in opens in ${h > 0 ? `${h}h ${m}m` : `${m}m`}`);
    } else if (check.minutesUntil < 0) {
      toast.success('✅ Journey in progress — check in anytime!');
    } else {
      toast.success(`✅ Check-in open! Departure in ${check.minutesUntil} min`);
    }
  }, []);

  // ── FIXED: Train departure check with overnight support ───
  const checkTrainDeparture = useCallback((data: any) => {
    const depTimeStr = data.DepartureTime || data.BoardingTime || data.ScheduledDeparture;
    if (!depTimeStr) { setDepartureCheck({ canCheckIn: true, minutesUntil: 0, tooLate: false }); return; }
    const depDate = parseTimeToDate(depTimeStr, data.DateOfJourney);
    if (!depDate) { setDepartureCheck({ canCheckIn: true, minutesUntil: 0, tooLate: false }); return; }
    const arrDate = data.DestinationArrival ? parseTimeToDate(data.DestinationArrival, data.DateOfJourney) : undefined;
    // Fix overnight trains: if arrival < departure, it's next day
    if (arrDate && depDate && arrDate < depDate) arrDate.setDate(arrDate.getDate() + 1);
    const check = checkDepartureTime(depDate, arrDate || undefined);
    setDepartureCheck(check);
    if (check.tooLate) toast.error('❌ This train has already arrived!');
    else if (!check.canCheckIn) {
      const minsUntilOpen = check.minutesUntil - 10;
      const h = Math.floor(minsUntilOpen / 60); const m = minsUntilOpen % 60;
      toast.warning(`⏰ Check-in opens in ${h > 0 ? `${h}h ${m}m` : `${m}m`}`);
    }
  }, []);

  const verifyGPS = async (from: string, to: string) => {
    setGpsStatus('fetching'); setGpsMessage('📍 Getting your location...');
    const location = await getCurrentLocation();
    if (!location) { setGpsStatus('skipped'); setGpsMessage('📍 Location unavailable — proceeding without GPS check'); return true; }
    setGpsResult(location); setGpsMessage('🤖 AI verifying your location...');
    const verification = await verifyLocationWithAI(location.lat, location.lng, from, to);
    if (verification.isOnRoute) { setGpsStatus('verified'); setGpsMessage(`✅ Location verified near ${verification.nearestCity}`); return true; }
    else { setGpsStatus('warning'); setGpsMessage(`⚠️ You seem far from this route. Near: ${verification.nearestCity}`); return false; }
  };

  const fetchPNR = async () => {
    if (pnr.length < 10) { toast.error('Please enter a valid 10-digit PNR'); return; }
    setFetchingVehicle(true); setDepartureCheck(null);
    try {
      const response = await fetch(`https://irctc-indian-railway-pnr-status.p.rapidapi.com/getPNRStatus/${pnr}`, { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': 'irctc-indian-railway-pnr-status.p.rapidapi.com', 'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY } });
      const data = await response.json();
      if (data && data.Destination) {
        setPnrData(data); checkTrainDeparture(data);
        toast.success('PNR fetched! Calculating travel time... 🤖');
        setFetchingTrainDuration(true);
        const mins = await getAIDuration(data.BoardingPoint || data.Origin, data.Destination);
        setTrainAIDuration(mins); setFetchingTrainDuration(false);
        const hrs = Math.floor(mins / 60); const remainMins = mins % 60;
        toast.success(`AI estimates ${hrs}h ${remainMins}m travel time 🚆`);
      } else toast.error('Invalid PNR or no data found');
    } catch { toast.error('Failed to fetch PNR'); }
    finally { setFetchingVehicle(false); }
  };

  const fetchBusById = async () => {
    if (!busIdInput.trim()) return;
    setFetchingVehicle(true); setBusNotFound(false); setBusData(null);
    setBusAIDuration(null); setDepartureCheck(null); setBoardingDirection(null);
    try {
      const { data } = await supabase.from('vehicles').select('*').ilike('vehicle_number', busIdInput.trim()).maybeSingle();
      if (data) {
        setBusData(data);
        toast.success(`${data.operator} found! Choose your boarding direction 👇`);
      } else {
        setBusNotFound(true);
        setDepartureCheck({ canCheckIn: true, minutesUntil: 0, tooLate: false });
        toast.info('Bus not registered yet — enter route details manually');
      }
    } catch { toast.error('Search failed. Please try again.'); }
    finally { setFetchingVehicle(false); }
  };

  const handleSelectDirection = async (direction: 'forward' | 'return') => {
    setBoardingDirection(direction);
    setBusAIDuration(null);
    checkBusDeparture(busData, direction);
    const from = direction === 'forward' ? busData.from_location : busData.to_location;
    const to = direction === 'forward' ? busData.to_location : busData.from_location;
    toast.success(`Got it! Calculating ${from} → ${to} travel time... 🤖`);
    setFetchingBusDuration(true);
    const mins = await getAIDuration(from, to);
    setBusAIDuration(mins); setFetchingBusDuration(false);
    const hrs = Math.floor(mins / 60); const remainMins = mins % 60;
    toast.success(`AI estimates ${hrs}h ${remainMins}m 🚌`);
  };

  const fetchManualBusDuration = async () => {
    if (!manualFrom.trim() || !manualTo.trim()) return;
    setFetchingBusDuration(true);
    const mins = await getAIDuration(manualFrom, manualTo);
    setBusAIDuration(mins); setFetchingBusDuration(false);
    const hrs = Math.floor(mins / 60); const remainMins = mins % 60;
    toast.success(`AI estimates ${hrs}h ${remainMins}m 🤖`);
  };

  const handleAnalyzeRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) { toast.error('Please enter both From and To locations'); return; }
    setAnalyzingRoute(true); setRouteAnalysis(null);
    try {
      const analysis = await analyzeRouteWithAI(routeFrom, routeTo);
      if (!analysis || !analysis.isValid) { toast.error('Could not find a valid route.'); setAnalyzingRoute(false); return; }
      setRouteAnalysis(analysis);
      const matches = await findCorridorMatches(analysis.corridor); setCorridorMatches(matches);
      const hrs = Math.floor(analysis.estimatedDurationMinutes / 60); const mins = analysis.estimatedDurationMinutes % 60;
      toast.success(matches > 0 ? `🎉 ${matches} traveler${matches > 1 ? 's' : ''} found! Est. ${hrs}h ${mins}m` : `Route analyzed! Est. ${hrs}h ${mins}m — be the first! 🌟`);
    } catch { toast.error('AI analysis failed.'); }
    finally { setAnalyzingRoute(false); }
  };

  // ── Banners ───────────────────────────────────────────────
  const DepartureBanner = () => {
    if (!departureCheck) return null;
    if (departureCheck.canCheckIn) return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
        <span className="text-xs font-medium text-green-700">{departureCheck.minutesUntil < 0 ? '✅ Journey in progress — check in anytime!' : '✅ Check-in window open — board your vehicle!'}</span>
      </motion.div>
    );
    if (departureCheck.tooLate) return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span className="text-xs font-medium text-red-700">❌ This vehicle has already reached its destination!</span>
      </motion.div>
    );
    const minsUntilOpen = departureCheck.minutesUntil - 10;
    const h = Math.floor(minsUntilOpen / 60); const m = minsUntilOpen % 60;
    const timeStr = countdown || (h > 0 ? `${h}h ${m}m` : `${m}m`);
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <div>
          <span className="text-xs font-medium text-amber-700">⏰ Check-in opens 10 mins before departure</span>
          <span className="text-xs text-amber-600 ml-1">— opens in {timeStr}</span>
        </div>
      </motion.div>
    );
  };

  const GPSBanner = () => {
    if (gpsStatus === 'idle') return null;
    const config = {
      fetching: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
      verified: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
      warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
      skipped: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', icon: <MapPin className="w-3.5 h-3.5" /> },
    }[gpsStatus] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', icon: null };
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-2 ${config.bg} border ${config.border} rounded-xl px-3 py-2`}>
        <span className={config.text}>{config.icon}</span>
        <span className={`text-xs font-medium ${config.text}`}>{gpsMessage}</span>
      </motion.div>
    );
  };

  // ── Submit handlers ───────────────────────────────────────
  const doTrainSubmit = async () => {
    if (!pnrData || !profession.trim() || !trainAIDuration) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const from = pnrData.BoardingPoint || pnrData.Origin;
      const to = pnrData.Destination;
      const gpsOk = await verifyGPS(from, to);
      if (!gpsOk) toast.warning('⚠️ You seem far from this route. Checking in anyway!');
      let expiresAt = calculateExpiryFromArrival(pnrData.DestinationArrival || '', pnrData.DateOfJourney, trainAIDuration);
      let arrivalTime = pnrData.DestinationArrival || '11:59 PM';
      const avatarUrl = userAvatar || await getUserAvatar(user.id);
      const vehicleId = pnrData.TrainNumber || pnr;

      const { data: existingCheckin } = await supabase.from('checkins').select('expires_at, arrival_time').eq('vehicle_id', vehicleId).eq('is_active', true).limit(1).maybeSingle();
      if (existingCheckin) {
        expiresAt = existingCheckin.expires_at;
        arrivalTime = existingCheckin.arrival_time;
      }

      const { error } = await supabase.from('checkins').insert({ user_id: user.id, name: userName, profession, vehicle_id: vehicleId, from_location: from, to_location: to, arrival_time: arrivalTime, expires_at: expiresAt, is_active: true, avatar_url: avatarUrl, gps_lat: gpsResult?.lat || null, gps_lng: gpsResult?.lng || null });
      if (error) throw error;
      await createGroupRoom(vehicleId);
      setCurrentUser({ name: userName, profession, vehicleId, from, to, arrivalTime });
      toast.success('Checked in! 🚆'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const doBusSubmit = async () => {
    const fromLocation = boardingDirection === 'return' ? (busData?.to_location || manualFrom) : (busData?.from_location || manualFrom);
    const toLocation = boardingDirection === 'return' ? (busData?.from_location || manualTo) : (busData?.to_location || manualTo);
    const vehicleId = busData?.vehicle_number || busIdInput.trim() || `MANUAL-${Date.now()}`;
    const depTimeStr = busData ? (boardingDirection === 'forward' ? (busData.forward_departure || busData.departure_time) : (busData.return_departure || busData.departure_time)) : undefined;

    if (!fromLocation || !toLocation) { toast.error('Please enter route details'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    if (!busAIDuration) { toast.error('Please wait for AI to calculate travel time'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const gpsOk = await verifyGPS(fromLocation, toLocation);
      if (!gpsOk) toast.warning('⚠️ You seem far from this route. Checking in anyway!');
      let expiresAt = calculateExpiryFromDuration(busAIDuration, depTimeStr);
      const arrivalObj = new Date(expiresAt);
      arrivalObj.setMinutes(arrivalObj.getMinutes() - 60);
      let arrivalTime = arrivalObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const avatarUrl = userAvatar || await getUserAvatar(user.id);

      const { data: existingCheckin } = await supabase.from('checkins').select('expires_at, arrival_time').eq('vehicle_id', vehicleId).eq('is_active', true).limit(1).maybeSingle();
      if (existingCheckin) {
        expiresAt = existingCheckin.expires_at;
        arrivalTime = existingCheckin.arrival_time;
      }

      const { error } = await supabase.from('checkins').insert({ user_id: user.id, name: userName, profession, vehicle_id: vehicleId, from_location: fromLocation, to_location: toLocation, arrival_time: arrivalTime, expires_at: expiresAt, is_active: true, avatar_url: avatarUrl, gps_lat: gpsResult?.lat || null, gps_lng: gpsResult?.lng || null });
      if (error) throw error;
      await createGroupRoom(vehicleId);
      setCurrentUser({ name: userName, profession, vehicleId, from: fromLocation, to: toLocation, arrivalTime });
      toast.success('Checked in! 🚌'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const doRouteSubmit = async () => {
    if (!routeAnalysis || !profession.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const gpsOk = await verifyGPS(routeFrom, routeTo);
      if (!gpsOk) toast.warning('⚠️ You seem far from this route. Checking in anyway!');
      let expiresAt = calculateExpiryFromDuration(routeAnalysis.estimatedDurationMinutes);
      let arrivalTime = routeAnalysis.estimatedTime;
      const avatarUrl = userAvatar || await getUserAvatar(user.id);
      // Generate a deterministic Route ID based on the corridor to allow matching!
      const corridorHash = routeAnalysis.corridor.length > 1 ? `${routeAnalysis.corridor[0].substring(0,3).toUpperCase()}-${routeAnalysis.corridor[routeAnalysis.corridor.length-1].substring(0,3).toUpperCase()}` : `ROUTE-${Date.now()}`;
      const vehicleId = `ROUTE-${corridorHash}`;

      const { data: existingCheckin } = await supabase.from('checkins').select('expires_at, arrival_time').eq('vehicle_id', vehicleId).eq('is_active', true).limit(1).maybeSingle();
      if (existingCheckin) {
        expiresAt = existingCheckin.expires_at;
        arrivalTime = existingCheckin.arrival_time;
      }

      const { error } = await supabase.from('checkins').insert({ user_id: user.id, name: userName, profession, vehicle_id: vehicleId, from_location: routeFrom.trim(), to_location: routeTo.trim(), arrival_time: arrivalTime, expires_at: expiresAt, is_active: true, avatar_url: avatarUrl, gps_lat: gpsResult?.lat || null, gps_lng: gpsResult?.lng || null });
      if (error) throw error;
      setCurrentUser({ name: userName, profession, vehicleId, from: routeFrom, to: routeTo, arrivalTime: routeAnalysis.estimatedTime });
      toast.success('Checked in! 🗺️'); navigate('/discovery');
    } catch { toast.error('Check-in failed.'); }
    finally { setLoading(false); }
  };

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrData) { toast.error('Please fetch PNR details first'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    if (!trainAIDuration) { toast.error('Still calculating travel time...'); return; }
    if (departureCheck && !departureCheck.canCheckIn) {
      if (departureCheck.tooLate) { toast.error('❌ This vehicle has already reached its destination!'); return; }
      // Too early — show game
      setWaitingMinutes(departureCheck.minutesUntil - 10);
      setShowWaitingGame(true);
      return;
    }
    doTrainSubmit();
  };

  const handleBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busData && !boardingDirection) { toast.error('Please select your boarding direction first'); return; }
    if (!busAIDuration) { toast.error('Please wait for AI to calculate travel time'); return; }
    if (busData && departureCheck && !departureCheck.canCheckIn) {
      if (departureCheck.tooLate) { toast.error('❌ This vehicle has already reached its destination!'); return; }
      // Too early — show game
      setWaitingMinutes(departureCheck.minutesUntil - 10);
      setShowWaitingGame(true);
      return;
    }
    doBusSubmit();
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeAnalysis) { toast.error('Please analyze your route first'); return; }
    if (!profession.trim()) { toast.error('Please enter your profession'); return; }
    doRouteSubmit();
  };

  const formatDuration = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${h}h ${m}m`; };
  const isTrainBlocked = departureCheck !== null && !departureCheck.canCheckIn && !departureCheck.tooLate;
  const isBusBlocked = busData !== null && boardingDirection !== null && departureCheck !== null && !departureCheck.canCheckIn && !departureCheck.tooLate;

  const tabs = [
    { id: 'reserved-train' as TabType, label: 'Train', icon: Train, color: '#1E88E5' },
    { id: 'reserved-bus' as TabType, label: 'Bus', icon: Bus, color: '#FF6B35' },
    { id: 'route-match' as TabType, label: 'Route Match', icon: Navigation, color: '#22c55e' },
  ];

  if (showWaitingGame) {
    return <WaitingGame minutesUntil={waitingMinutes} onCheckInReady={() => setShowWaitingGame(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0] overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-64 h-64 rounded-full bg-[#1E88E5]/10 blur-3xl" animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity }} style={{ top: '5%', left: '5%' }} />
        <motion.div className="absolute w-80 h-80 rounded-full bg-[#FF6B35]/10 blur-3xl" animate={{ x: [0, -80, 0], y: [0, 40, 0], scale: [1, 1.3, 1] }} transition={{ duration: 12, repeat: Infinity }} style={{ bottom: '10%', right: '5%' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-center gap-3 px-4 pt-12 pb-4">
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}><CompassLogo /></motion.div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#534AB7] to-[#D4537E] bg-clip-text text-transparent">MeetDestiny</h1>
            <p className="text-xs text-gray-500">Start your journey</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="px-4 mb-4">
          <div className="flex rounded-2xl bg-white/60 backdrop-blur p-1.5 gap-1 shadow-md border border-white/40">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setBusData(null); setBusNotFound(false); setRouteAnalysis(null); setBusAIDuration(null); setTrainAIDuration(null); setPnrData(null); setGpsStatus('idle'); setGpsMessage(''); setDepartureCheck(null); setBoardingDirection(null); }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-medium transition-all duration-300 ${activeTab === tab.id ? 'bg-white shadow-md text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                <tab.icon className="w-5 h-5" style={{ color: activeTab === tab.id ? tab.color : undefined }} />
                <span className="leading-tight text-center text-[11px]">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex-1 px-4 pb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/30">

            {/* User info */}
            <div className="mb-5 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-10 h-10 rounded-full object-cover border-2 border-[#534AB7]/20 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#534AB7] to-[#D4537E] flex items-center justify-center text-white text-sm font-bold shrink-0">{userName.charAt(0).toUpperCase() || '?'}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-800">{userName || 'Loading...'}</p>
                  <p className="text-xs text-gray-400">from your Google account</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Your Profession</label>
                <Input type="text" placeholder="e.g., Software Engineer, Student..." value={profession} onChange={(e) => setProfession(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#534AB7] bg-white text-sm" />
              </div>
            </div>

            <div className="mb-5">
              <AdSlot />
            </div>

            <AnimatePresence mode="wait">

              {/* ── TRAIN TAB ── */}
              {activeTab === 'reserved-train' && (
                <motion.form key="train" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} onSubmit={handleTrainSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"><Train className="w-3.5 h-3.5 text-[#1E88E5]" /> PNR Number</label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Enter 10-digit PNR" value={pnr} onChange={(e) => setPnr(e.target.value)} maxLength={10} className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#1E88E5] bg-white text-sm" />
                      <Button type="button" onClick={fetchPNR} disabled={fetchingVehicle || pnr.length < 10} className="h-12 px-4 rounded-xl bg-[#1E88E5] hover:bg-[#1565C0] text-white shrink-0">
                        {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">🔒 PNR only used to fetch journey details — never stored.</p>
                  </div>

                  {pnrData && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 border-2 border-[#1E88E5]/20 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-[#1E88E5] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Train className="w-3.5 h-3.5" /> Journey Details</p>
                      <div className="grid grid-cols-2 gap-2.5 text-sm">
                        <div><span className="text-gray-400 text-xs block">Train</span><p className="font-medium text-gray-800">{pnrData.TrainNumber}</p></div>
                        <div><span className="text-gray-400 text-xs block">Date</span><p className="font-medium text-gray-800">{pnrData.DateOfJourney}</p></div>
                        <div><span className="text-gray-400 text-xs block">From</span><p className="font-medium text-gray-800">{pnrData.BoardingPoint || pnrData.Origin}</p></div>
                        <div><span className="text-gray-400 text-xs block">To</span><p className="font-medium text-gray-800">{pnrData.Destination}</p></div>
                        <div><span className="text-gray-400 text-xs block">Arrival</span><p className="font-medium text-gray-800">{pnrData.DestinationArrival}</p></div>
                        <div><span className="text-gray-400 text-xs block">Class</span><p className="font-medium text-gray-800">{pnrData.Class}</p></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        {fetchingTrainDuration ? (
                          <div className="flex items-center gap-2 text-xs text-[#1E88E5]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI calculating realistic travel time...</div>
                        ) : trainAIDuration ? (
                          <div className="flex items-center gap-1.5 bg-blue-100 rounded-lg px-3 py-1.5"><Clock className="w-3.5 h-3.5 text-[#1E88E5]" /><span className="text-xs font-semibold text-[#1E88E5]">🤖 AI estimate: {formatDuration(trainAIDuration)} + 1hr buffer</span></div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}

                  {pnrData && <LiveVehicleStatus vehicleId={pnrData.TrainNumber || pnr} />}

                  <DepartureBanner />
                  <GPSBanner />

                  <Button type="submit" disabled={loading || !pnrData || !profession.trim() || !trainAIDuration}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white font-medium shadow-lg disabled:opacity-50 text-base">
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{gpsStatus === 'fetching' ? 'Verifying location...' : 'Checking in...'}</span>
                      : isTrainBlocked ? '🎮 Play while you wait!'
                        : '🚆 Start Networking'}
                  </Button>
                </motion.form>
              )}

              {/* ── BUS TAB ── */}
              {activeTab === 'reserved-bus' && (
                <motion.form key="bus" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} onSubmit={handleBusSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"><Bus className="w-3.5 h-3.5 text-[#FF6B35]" /> Bus ID <span className="text-gray-400 font-normal">(sticker on bus)</span></label>
                    <div className="flex gap-2">
                      <Input type="text" placeholder="e.g., BAN-CHE-0101" value={busIdInput}
                        onChange={(e) => { setBusIdInput(e.target.value.toUpperCase()); setBusData(null); setBusNotFound(false); setBusAIDuration(null); setDepartureCheck(null); setBoardingDirection(null); }}
                        className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#FF6B35] bg-white font-mono text-sm" />
                      <Button type="button" onClick={fetchBusById} disabled={fetchingVehicle || !busIdInput.trim()} className="h-12 px-4 rounded-xl bg-[#FF6B35] hover:bg-[#E85A2B] text-white shrink-0">
                        {fetchingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Boarding direction selector */}
                  {busData && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="bg-orange-50 border-2 border-[#FF6B35]/20 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Which direction are you traveling?
                        </p>
                        <p className="text-xs text-gray-500 mb-3">This bus runs both directions. Select where you're boarding from:</p>
                        <div className="grid grid-cols-1 gap-2">
                          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => handleSelectDirection('forward')}
                            style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${boardingDirection === 'forward' ? '#FF6B35' : '#e2e8f0'}`, background: boardingDirection === 'forward' ? 'rgba(255,107,53,0.08)' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>🚌</span>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: boardingDirection === 'forward' ? '#FF6B35' : '#1e293b', margin: 0 }}>{busData.from_location} → {busData.to_location}</p>
                                {busData.forward_departure && <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Departs: {busData.forward_departure}</p>}
                              </div>
                              {boardingDirection === 'forward' && <span style={{ marginLeft: 'auto', color: '#FF6B35', fontSize: 16 }}>✅</span>}
                            </div>
                          </motion.button>
                          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => handleSelectDirection('return')}
                            style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${boardingDirection === 'return' ? '#FF6B35' : '#e2e8f0'}`, background: boardingDirection === 'return' ? 'rgba(255,107,53,0.08)' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>🔄</span>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: boardingDirection === 'return' ? '#FF6B35' : '#1e293b', margin: 0 }}>{busData.to_location} → {busData.from_location}</p>
                                {busData.return_departure && <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Departs: {busData.return_departure}</p>}
                              </div>
                              {boardingDirection === 'return' && <span style={{ marginLeft: 'auto', color: '#FF6B35', fontSize: 16 }}>✅</span>}
                            </div>
                          </motion.button>
                        </div>
                        {fetchingBusDuration && <div className="flex items-center gap-2 text-xs text-[#FF6B35] mt-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI calculating travel time...</div>}
                        {busAIDuration && !fetchingBusDuration && (
                          <div className="flex items-center gap-1.5 bg-orange-100 rounded-lg px-3 py-1.5 mt-3">
                            <Clock className="w-3.5 h-3.5 text-[#FF6B35]" />
                            <span className="text-xs font-semibold text-[#FF6B35]">🤖 AI estimate: {formatDuration(busAIDuration)} + 1hr buffer</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {busData && boardingDirection && <LiveVehicleStatus vehicleId={busData.vehicle_number} />}

                  {/* Manual fallback */}
                  {busNotFound && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3">
                        <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Bus not registered yet</p>
                        <p className="text-xs text-amber-600">Enter route details — AI will calculate travel time!</p>
                      </div>
                      <Input type="text" placeholder="Bus Operator (e.g., NueGo, KSRTC)" value={manualOperator} onChange={(e) => setManualOperator(e.target.value)} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">From City *</label>
                          <Input type="text" placeholder="Bangalore" value={manualFrom} onChange={(e) => { setManualFrom(e.target.value); setBusAIDuration(null); }} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" /></div>
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">To City *</label>
                          <Input type="text" placeholder="Chennai" value={manualTo} onChange={(e) => { setManualTo(e.target.value); setBusAIDuration(null); }} className="h-12 rounded-xl border-2 border-gray-200 bg-white text-sm" /></div>
                      </div>
                      <Button type="button" onClick={fetchManualBusDuration} disabled={fetchingBusDuration || !manualFrom.trim() || !manualTo.trim()} className="w-full h-11 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border-2 border-amber-200 font-medium">
                        {fetchingBusDuration ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> AI calculating...</span> : '🤖 Calculate Travel Time with AI'}
                      </Button>
                      {busAIDuration && (
                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700">🤖 AI estimate: {formatDuration(busAIDuration)} + 1hr buffer</span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <DepartureBanner />
                  <GPSBanner />

                  <Button type="submit" disabled={loading || (!busData && !busNotFound) || !busAIDuration}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E85A2B] text-white font-medium shadow-lg disabled:opacity-50 text-base">
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{gpsStatus === 'fetching' ? 'Verifying location...' : 'Checking in...'}</span>
                      : isBusBlocked ? '🎮 Play while you wait!'
                        : '🚌 Start Networking'}
                  </Button>
                </motion.form>
              )}

              {/* ── ROUTE MATCH TAB ── */}
              {activeTab === 'route-match' && (
                <motion.form key="route" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} onSubmit={handleRouteSubmit} className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs text-green-700 font-medium">🤖 AI-powered route matching</p>
                    <p className="text-xs text-green-600 mt-0.5">Enter your start and end — AI figures out the route and finds co-travelers!</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3 text-[#22c55e]" /> From</label>
                      <Input type="text" placeholder="e.g., Shadnagar" value={routeFrom} onChange={(e) => { setRouteFrom(e.target.value); setRouteAnalysis(null); }} className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white text-sm" /></div>
                    <div><label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3 text-[#22c55e]" /> To</label>
                      <Input type="text" placeholder="e.g., Bangalore" value={routeTo} onChange={(e) => { setRouteTo(e.target.value); setRouteAnalysis(null); }} className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#22c55e] bg-white text-sm" /></div>
                  </div>
                  <Button type="button" onClick={handleAnalyzeRoute} disabled={analyzingRoute || !routeFrom.trim() || !routeTo.trim()} className="w-full h-12 rounded-xl bg-green-50 hover:bg-green-100 text-[#22c55e] border-2 border-green-200 font-medium disabled:opacity-50">
                    {analyzingRoute ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> AI analyzing route...</span> : '🤖 Analyze Route with AI'}
                  </Button>
                  {routeAnalysis && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Route className="w-3.5 h-3.5" /> AI Route Analysis</p>
                        <div className="grid grid-cols-2 gap-2.5 text-sm mb-3">
                          <div><span className="text-gray-400 text-xs block">Travel Time</span><p className="font-semibold text-gray-800">{routeAnalysis.estimatedTime}</p><p className="text-xs text-green-600">+1hr buffer included</p></div>
                          <div><span className="text-gray-400 text-xs block">Distance</span><p className="font-semibold text-gray-800">{routeAnalysis.distance}</p></div>
                          <div className="col-span-2"><span className="text-gray-400 text-xs block">Highway</span><p className="font-medium text-gray-800">{routeAnalysis.highway}</p></div>
                        </div>
                        {routeAnalysis.corridor.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Route corridor</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {routeAnalysis.corridor.map((stop, i) => (
                                <React.Fragment key={i}>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${i === 0 || i === routeAnalysis.corridor.length - 1 ? 'bg-[#22c55e] text-white font-medium' : 'bg-white border border-green-200 text-gray-600'}`}>{stop}</span>
                                  {i < routeAnalysis.corridor.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`rounded-2xl p-4 text-center border-2 ${corridorMatches > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        {corridorMatches > 0 ? (<><p className="text-3xl font-bold text-[#22c55e]">{corridorMatches}</p><p className="text-sm text-gray-600 mt-1">traveler{corridorMatches > 1 ? 's' : ''} on this corridor right now!</p></>) : (<><p className="text-lg font-semibold text-gray-500">No one yet</p><p className="text-xs text-gray-400 mt-1">Be the first — others will find you! 🌟</p></>)}
                      </div>
                    </motion.div>
                  )}
                  <GPSBanner />
                  <Button type="submit" disabled={loading || !routeAnalysis || !profession.trim()} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-medium shadow-lg disabled:opacity-50 text-base">
                    {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{gpsStatus === 'fetching' ? 'Verifying location...' : 'Checking in...'}</span> : '🗺️ Start Networking'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-4 bg-white/60 backdrop-blur border border-white/40 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 text-center mb-2">✨ <span className="font-medium text-gray-700">Safe travels!</span> Your check-in expires automatically when you reach your destination.</p>
            <div className="flex justify-center items-center gap-3 text-xs text-gray-400">
              <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
              <span>•</span>
              <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};