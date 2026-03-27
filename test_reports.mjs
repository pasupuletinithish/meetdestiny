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
  console.log('Signing up dummy user...');
  const email = `test_report_${Date.now()}@example.com`;
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password: 'StrongPassword123!',
    options: {
      data: { full_name: 'Test Reporter' }
    }
  });

  if (authErr && authErr.message !== 'User already registered') {
    console.error('Auth error:', authErr);
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    console.log('No user id');
    return;
  }
  console.log('Logged in as', userId);

  const { data: profiles } = await supabase.from('user_profiles').select('user_id').limit(1);
  const targetId = profiles?.length > 0 ? profiles[0].user_id : userId;

  console.log(`Attempting to report user ${targetId}...`);
  const { data, error } = await supabase.from('reports').insert({
    reporter_id: userId,
    reported_id: targetId,
    reason: 'Testing RLS',
    context: 'Test script',
    status: 'pending'
  });

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success. Data:', data);
  }

  const { data: reportsData } = await supabase.from('reports').select('*');
  console.log('Total reports:', reportsData?.length);

  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('reports').delete().eq('reporter_id', userId);
}

testInsertReport();
