import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ludgnllvlhzqaycrknuk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGdubGx2bGh6cWF5Y3JrbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODcxMzAsImV4cCI6MjA4OTA2MzEzMH0.8Ve1aXivxUUQPXffoTqkDET8yAuAjCf-9UmNDEVC7VA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)