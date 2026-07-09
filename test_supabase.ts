import { supabase } from './services/supabaseClient';

async function test() {
  console.log("Testing Supabase connection...");
  
  console.log("\n1. Testing 'demands_notifications' table:");
  const r1 = await supabase.from('demands_notifications').select('*').limit(1);
  if (r1.error) {
    console.error("Error code:", r1.error.code);
    console.error("Error message:", r1.error.message);
    console.error("Error details:", r1.error.details);
    console.error("Error hint:", r1.error.hint);
  } else {
    console.log("Success! Data:", r1.data);
  }

  console.log("\n2. Testing 'surveys' table:");
  const r2 = await supabase.from('surveys').select('*').limit(1);
  if (r2.error) {
    console.error("Error code:", r2.error.code);
    console.error("Error message:", r2.error.message);
    console.error("Error details:", r2.error.details);
    console.error("Error hint:", r2.error.hint);
  } else {
    console.log("Success! Data:", r2.data);
  }

  console.log("\n3. Testing 'demands_v2' table:");
  const r3 = await supabase.from('demands_v2').select('*').limit(1);
  if (r3.error) {
    console.error("Error code:", r3.error.code);
    console.error("Error message:", r3.error.message);
    console.error("Error details:", r3.error.details);
    console.error("Error hint:", r3.error.hint);
  } else {
    console.log("Success! Data:", r3.data);
  }
}

test().catch(console.error);
