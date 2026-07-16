import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const { data: page_permissions, error: pError } = await supabase
    .from('page_permissions')
    .select('*');

  console.log("page_permissions:", pError ? pError : page_permissions);
}

test();
