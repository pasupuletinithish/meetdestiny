import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export type VibeStatus = 'ready' | 'logistics' | 'lurking';

// Kept for backward compatibility with CheckIn page setCurrentUser
export interface User {
  name: string;
  profession: string;
  vehicleId: string;
  from: string;
  to: string;
  arrivalTime: string;
  vibe?: VibeStatus;
  id?: string;
}

interface AppContextType {
  // currentUser kept only for CheckIn → DiscoveryHub transition
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // UI state — still used across pages
  invisibleMode: boolean;
  setInvisibleMode: (mode: boolean) => void;

  // Vibe — still used in UserProfile locally before Supabase sync
  currentUserVibe: VibeStatus;
  setCurrentUserVibe: (vibe: VibeStatus) => void;

  // Filter — used in DiscoveryHub filter pills
  professionFilter: string;
  setProfessionFilter: (filter: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [invisibleMode, setInvisibleMode] = useState(false);
  const [currentUserVibe, setCurrentUserVibe] = useState<VibeStatus>('ready');
  const [professionFilter, setProfessionFilter] = useState<string>('All');

  useEffect(() => {
    const checkExpiry = async () => {
      // Skip check if user is on login, check-in, or related open routes
      const path = window.location.pathname;
      if (path === '/' || path === '/check-in' || path === '/terms' || path === '/privacy') return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: checkin } = await supabase
        .from('checkins')
        .select('expires_at')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkin && checkin.expires_at) {
        const expiresAt = new Date(checkin.expires_at).getTime();
        const now = new Date().getTime();
        
        if (now >= expiresAt) {
          toast.error('Your journey has ended! Returning to login...', { duration: 5000 });
          await supabase.auth.signOut();
          window.location.href = '/';
        }
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      invisibleMode,
      setInvisibleMode,
      currentUserVibe,
      setCurrentUserVibe,
      professionFilter,
      setProfessionFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
};