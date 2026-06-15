import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://tkzcspqyiqmqmyjrouzn.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRremNzcHF5aXFtcW15anJvdXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Nzk3NzQsImV4cCI6MjA5NzA1NTc3NH0.XBA1HJQ_Cxif4bUfqVgo8BjSO3NB0WeazbCJSycANrU"

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)