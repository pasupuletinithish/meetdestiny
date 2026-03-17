import React, { createContext, useContext, useState, ReactNode } from 'react';

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