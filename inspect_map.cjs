const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d29tYWtqaG1nbGdvb3dibXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzM3NzUsImV4cCI6MjA4MTU0OTc3NX0.f-FbwrnnlUFermnqLUyPHpT-EoUEc1dzXTlV4cXyQ28';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('buy_tipo_subtipo_map')
    .select('categoria, subtipo');
  
  if (error) {
    console.error(error);
  } else {
    const cats = new Set();
    const subs = new Set();
    const map = {};
    data.forEach(r => {
      cats.add(r.categoria);
      if (r.subtipo) {
        subs.add(r.subtipo);
        if (!map[r.categoria]) map[r.categoria] = new Set();
        map[r.categoria].add(r.subtipo);
      }
    });
    console.log('Categories:', Array.from(cats));
    console.log('Mappings:', Object.keys(map).reduce((acc, cat) => {
      acc[cat] = Array.from(map[cat]);
      return acc;
    }, {}));
  }
}

run();
