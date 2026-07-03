export const PRINT_BASE_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; margin:0; padding:0; color:#12213D; font-size: 11px; line-height:1.5; }
    .rp-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
    .rp-header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #12213D; padding-bottom: 12px; margin-bottom: 20px; }
    .rp-eyebrow { margin:0; font-size:10px; font-weight:600; letter-spacing:0.14em; color:#64748B; text-transform: uppercase; }
    .rp-title { margin:4px 0 0; font-size:21px; font-weight:700; color:#12213D; }
    .rp-meta { margin:0 0 2px; font-size:11px; font-weight:500; color:#64748B; text-align:right; }
    .rp-section { margin-bottom: 18px; }
    .rp-section-title { font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#64748B; border-bottom:1px solid #E2E8F0; padding-bottom:6px; margin-bottom:10px; }
    .rp-kpi-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; font-size:12px; }
    .rp-kpi-row.total { border-top:1.5px solid #12213D; margin-top:8px; padding-top:12px; font-size:16px; font-weight:700; }
    table.rp-table { width:100%; border-collapse:collapse; }
    table.rp-table th { text-align:left; font-size:9px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#64748B; padding:8px 6px; border-bottom:1px solid #12213D; }
    table.rp-table td { padding:7px 6px; font-size:10.5px; border-bottom:0.5px solid #E2E8F0; }
    .rp-mini-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
    .rp-mini-card { border:0.5px solid #E2E8F0; border-radius:6px; padding:8px 10px; }
    .rp-mini-label { margin:0; font-size:9px; font-weight:600; text-transform:uppercase; color:#12213D; }
    .rp-mini-sub { margin:2px 0; font-size:8px; color:#94A3B8; }
    .rp-mini-value { margin:2px 0 0; font-size:12px; font-weight:600; color:#3C3489; }
    .rp-alert { background:#FCEBEB; border:0.5px solid #F09595; border-radius:6px; padding:10px 12px; margin-bottom:14px; }
    .rp-alert-title { margin:0 0 4px; font-size:11px; font-weight:700; color:#791F1F; }
    .rp-alert-line { margin:2px 0; font-size:9.5px; color:#791F1F; }
    .rp-signatures { display:flex; justify-content:space-between; gap:30px; margin-top:44px; }
    .rp-sig-block { flex:1; text-align:center; }
    .rp-sig-line { border-top:1px solid #12213D; margin-bottom:6px; }
    .rp-sig-label { margin:0; font-size:9px; font-weight:600; text-transform:uppercase; color:#64748B; }
    .rp-status-pill { display:inline-block; padding:2px 8px; border-radius:3px; font-size:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
    .rp-status-vencido { background:#FCEBEB; color:#791F1F; }
    .rp-status-avencer { background:#FAEEDA; color:#633806; }
    .rp-status-pago { background:#EAF3DE; color:#173404; }
    .rp-status-emdia { background:#E6F1FB; color:#0C447C; }
    .rp-footer { margin-top:28px; padding-top:10px; border-top:0.5px solid #E2E8F0; font-size:9px; color:#94A3B8; text-align:center; }
    .no-print { display:flex; justify-content:center; margin-top:20px; }
    .close-btn { background:#12213D; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12px; }
    @media print { .no-print { display:none; } }
`;

export const buildPrintHeader = (opts: { eyebrow: string; title: string; storeLine: string; periodLine: string }) => `
    <div class="rp-header">
        <div>
            <p class="rp-eyebrow">${opts.eyebrow}</p>
            <h1 class="rp-title">${opts.title}</h1>
        </div>
        <div>
            <p class="rp-meta">${opts.storeLine}</p>
            <p class="rp-meta">${opts.periodLine}</p>
        </div>
    </div>
`;

export const buildPrintFooter = () => `
    <div class="rp-footer">Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema Real Admin · Sorveteria Real</div>
    <div class="no-print"><button class="close-btn" onclick="window.close()">Fechar relatório</button></div>
`;

export const PRINT_AUTOCLOSE_SCRIPT = `
    <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 800); };
    </script>
`;
