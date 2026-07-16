module.exports = {
  apps: [{
    name: 'realadmin',
    script: 'npx',
    args: 'tsx server.ts',
    cwd: '/home/realcalcados/apps/realcalcados',
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://rwwomakjhmglgoowbmsl.supabase.co',
      SUPABASE_SERVICE_KEY: 'COLOQUE_A_CHAVE_AQUI'
    }
  }]
}
