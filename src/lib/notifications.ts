import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    let cleanBase64 = base64String.replace(/^["']|["']$/g, '').trim();
    if (cleanBase64.startsWith('VITE_VAPID_PUBLIC_KEY=')) {
      cleanBase64 = cleanBase64.replace('VITE_VAPID_PUBLIC_KEY=', '');
    }
    const padding = '='.repeat((4 - (cleanBase64.length % 4)) % 4);
    const base64 = (cleanBase64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e: any) {
    throw new Error(`Invalid VAPID Key Format: "${base64String}". Ensure you copied JUST the key value into Vercel, without quotes or "VITE_VAPID_PUBLIC_KEY=". Error: ${e.message}`);
  }
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Request permission and subscribe
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) return { success: false, error: 'Push not supported on this browser' };

  try {
    if (!VAPID_PUBLIC_KEY) {
      return { success: false, error: 'VITE_VAPID_PUBLIC_KEY is missing in your environment variables' };
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied. Please allow notifications in site settings.' };
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });

    // Save subscription to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You must be logged in to enable notifications.' };

    const { error: dbError } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      subscription: subscription.toJSON(),
    }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('Database save error:', dbError);
      return { success: false, error: 'Failed to save subscription to database.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Push subscription failed:', err);
    return { success: false, error: err.message || 'An unknown error occurred' };
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    }
  } catch (err) {
    console.error('Unsubscribe failed:', err);
  }
}

// Check if already subscribed
export async function isSubscribed(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Send push notification to a user (called server-side via edge function)
export async function sendPushNotification({
  userId,
  title,
  body,
  url = '/',
}: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { user_id: userId, title, body, url }
    });
    
    if (error) {
      console.error('Failed edge function delivery:', error.message || error);
    } else {
      console.log('Push sent successfully via Edge function:', data);
    }
  } catch (err) {
    console.error('Failed to invoke push notification:', err);
  }
}

// Notification helpers for specific events
export const notify = {
  ping: (toUserId: string, fromName: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '👋 New Ping!',
      body: `${fromName} pinged you on Destiny`,
      url: '/discovery',
    }),

  newTraveler: (toUserId: string, name: string, vehicleId: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '🚌 New Traveler Joined!',
      body: `${name} just checked in on ${vehicleId}`,
      url: '/discovery',
    }),

  friendRequest: (toUserId: string, fromName: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '👥 Friend Request!',
      body: `${fromName} wants to connect with you`,
      url: '/friends',
    }),

  friendAccepted: (toUserId: string, name: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '🎉 Friend Request Accepted!',
      body: `${name} accepted your friend request`,
      url: '/friends',
    }),

  sos: (toUserId: string, name: string, vehicleId: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '🆘 SOS Alert!',
      body: `${name} needs help on ${vehicleId}`,
      url: '/safety-sos',
    }),

  message: (toUserId: string, fromName: string) =>
    sendPushNotification({
      userId: toUserId,
      title: '💬 New Message',
      body: `${fromName} sent you a message`,
      url: '/lounge',
    }),
};