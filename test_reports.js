import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ludgnllvlhzqaycrknuk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.log('No supabase key, attempting to read from .env');
  const fs = require('fs');
  const env = fs.readFileSync('C:\\Users\\pmani\\Downloads\\Design travel networking app\\.env', 'utf8');
  const match = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (match) {
    process.env.VITE_SUPABASE_ANON_KEY = match[1].trim();
  }
}

const supabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

async function checkReports() {
  console.log('Fetching reports...');
  const { data, error } = await supabase.from('reports').select('*');
  if (error) {
    console.error('Error fetching reports:', error);
  } else {
    console.log(`Found ${data.length} reports.`);
    console.dir(data, { depth: null });
  }

  const { data: userProfiles, error: err2 } = await supabase.from('user_profiles').select('user_id, name');
  console.log(`User profiles count: ${userProfiles?.length || 0}`);
}

checkReports();
