const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d29tYWtqaG1nbGdvb3dibXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzM3NzUsImV4cCI6MjA4MTU0OTc3NX0.f-FbwrnnlUFermnqLUyPHpT-EoUEc1dzXTlV4cXyQ28';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const matchers = [
  {
    subtipo: 'Bolas Esportivas',
    test: (t) => t.startsWith('BOLA') || t.startsWith('MINI BOLA')
  },
  {
    subtipo: 'Equipamento de Futebol',
    test: (t) => t.startsWith('PORTA CHUTEIRA') || t.startsWith('CALIBRADOR') || t.startsWith('LUVA')
  },
  {
    subtipo: 'Proteção Esportiva',
    test: (t) => t.startsWith('CANELEIRA') || t.startsWith('CANELITO') || t.startsWith('COXAL') || t.startsWith('JOELHEIRA') || t.startsWith('TORNOZELEIRA')
  },
  {
    subtipo: 'Óculos',
    test: (t) => t.startsWith('OCULO')
  },
  {
    subtipo: 'Cintos',
    test: (t) => t.startsWith('CINTO')
  },
  {
    subtipo: 'Carteiras',
    test: (t) => t.startsWith('CARTEIRA') || t.startsWith('KIT CARTEIRA')
  },
  {
    subtipo: 'Necessaire',
    test: (t) => t.startsWith('NECESSAIRE')
  },
  {
    subtipo: 'Mochilas',
    test: (t) => t.startsWith('MOCHILA')
  },
  {
    subtipo: 'Bolsas',
    test: (t) => t.startsWith('FRASQUEIRA') || t.includes('CROOSBODY') || t.includes('CROSSBODY') || t.includes('SHOPPING BAG') || t.includes('TOTE') || t.includes('TIRACOLO') || t.includes('PASTA') || t.startsWith('SACOLA') || t.includes('CAMERA BAG')
  },
  {
    subtipo: 'Vestuário',
    test: (t) => t.startsWith('BERMUDA') || t.startsWith('CALCA') || t.startsWith('CALCAO') || t.startsWith('CAMISETA LUPO') || t.startsWith('MACACAO LUPO') || t.startsWith('MACAQUINHO LUPO') || t.startsWith('SHORT') || t.startsWith('TOP')
  }
];

async function run() {
  const { data: rows, error } = await supabase
    .from('buy_tipo_subtipo_map')
    .select('*')
    .eq('categoria', 'ACESSORIO');
  
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total ACESSORIO rows fetched: ${rows.length}`);
  const matched = [];
  const unmatchedNulls = [];
  
  rows.forEach(row => {
    if (row.tipo_raw === 'SAPATILHA MOLECA TECIDO ORION') {
      console.log(`Explicitly skipping SAPATILHA MOLECA TECIDO ORION`);
      return;
    }
    const t = row.tipo_raw.toUpperCase().trim();
    let found = false;
    for (const m of matchers) {
      if (m.test(t)) {
        matched.push({ id: row.id, tipo_raw: row.tipo_raw, old_subtipo: row.subtipo, new_subtipo: m.subtipo });
        found = true;
        break;
      }
    }
    if (!found && !row.subtipo) {
      unmatchedNulls.push(row.tipo_raw);
    }
  });

  console.log(`Matched rows count: ${matched.length}`);
  console.log('Sample matched updates:', matched.slice(0, 15));
  console.log(`Unmatched nulls count: ${unmatchedNulls.length}`);
  console.log('Unmatched nulls:', unmatchedNulls);
}

run();
