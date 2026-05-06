import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "SELECT prosrc FROM pg_proc WHERE proname = 'return_quota_on_cancel';"
  });
  console.log("EXECUTE SQL DATA", data);
  console.log("EXECUTE SQL ERROR", error);
}

run();
