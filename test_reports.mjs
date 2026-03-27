import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';

for (const line of env.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function testInsertReport() {
  console.log('Signing in anonymously...');
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();

  if (authErr) {
    console.error('Auth error:', authErr);
    // fallback just running it unauthenticated
  } else {
    console.log('Logged in anonymously as', authData.user?.id);
  }

  const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000000';

  console.log(`Attempting to report user...`);
  const payload = {
    reporter_id: userId,
    reported_id: '1cf51d94-4915-4f1e-aa01-4d396b635d82', // Arbitrary UUID
    reason: 'Testing RLS',
    context: 'Test script',
    status: 'pending'
  };
  
  const { data, error } = await supabase.from('reports').insert(payload).select();

  if (error) {
    console.error('Insert Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert Success. Data:', data);
  }
}

testInsertReport();
