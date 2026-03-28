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

async function testQuery() {
  const dummy1 = '11111111-1111-1111-1111-111111111111';
  const dummy2 = '22222222-2222-2222-2222-222222222222';

  const { data, error } = await supabase.from('blocked_users').select('id')
    .or(`and(blocker_id.eq.${dummy1},blocked_id.eq.${dummy2}),and(blocker_id.eq.${dummy2},blocked_id.eq.${dummy1})`)
    .limit(1);

  console.log('Query result:', data);
  if (error) console.error('Query error:', error);
  
}

testQuery();
