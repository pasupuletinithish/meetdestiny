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
  const { data: authData } = await supabase.auth.signInAnonymously();
  const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000000';

  console.log(`Payload 1: standard`);
  let res = await supabase.from('reports').insert({
    reporter_id: userId,
    reported_id: userId,
    reason: 'Testing RLS',
    status: 'pending'
  });
  console.log('Result 1:', res.error?.message || 'Success');

  console.log(`Payload 2: with user_id`);
  res = await supabase.from('reports').insert({
    user_id: userId,
    reporter_id: userId,
    reported_id: userId,
    reason: 'Testing RLS',
    status: 'pending'
  });
  console.log('Result 2:', res.error?.message || 'Success');

}

testInsertReport();
