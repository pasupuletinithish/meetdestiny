import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handlePostLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate('/');
        return;
      }

      const user = session.user;

      // Check if profile exists
      const { data: existing } = await supabase
        .from('user_profiles').select('role')
        .eq('user_id', user.id).maybeSingle();

      if (!existing) {
        // Brand new user — create profile and send to check-in
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          name: user.user_metadata?.full_name || '',
          profession: '',
          total_journeys: 0,
          role: 'user',
        });
        navigate('/check-in');
        return;
      }

      // Admin check
      if (existing.role?.toLowerCase() === 'admin') {
        navigate('/admin');
        return;
      }

      // Active journey check
      const { data: activeCheckin } = await supabase
        .from('checkins').select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (activeCheckin) {
        navigate('/discovery');
        return;
      }

      // Friends check (returning user)
      const { count } = await supabase
        .from('friends').select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (count && count > 0) {
        navigate('/discovery'); // Returning user — show Start New Journey
      } else {
        navigate('/check-in'); // New user
      }
    };

    handlePostLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E3F2FD] via-white to-[#FFE8E0]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#1E88E5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Signing you in...</p>
        <p className="text-gray-400 text-sm mt-1">Setting up your journey</p>
      </div>
    </div>
  );
}