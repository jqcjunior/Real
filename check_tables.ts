import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d29tYWtqaG1nbGdvb3dibXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzM3NzUsImV4cCI6MjA4MTU0OTc3NX0.f-FbwrnnlUFermnqLUyPHpT-EoUEc1dzXTlV4cXyQ28';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Checking for database tables...");
  
  // Try querying a generic table to see if it works
  const { data: bOrders, error: bOrdersError } = await supabase.from('buy_orders').select('id').limit(1);
  if (bOrdersError) {
    console.error("Error querying buy_orders:", bOrdersError);
  } else {
    console.log("Successfully queried buy_orders, connection OK.");
  }

  // Try querying potential vote tables
  const tables = [
    'buy_order_survey_votes',
    'buy_order_votes',
    'buy_orders_votes',
    'buy_order_votes_survey',
    'buy_order_items_votes',
    'buy_order_item_votes'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}' query failed:`, error.message);
    } else {
      console.log(`Table '${table}' exists! Data:`, data);
    }
  }
}

run();
