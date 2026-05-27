require('dotenv').config();
const cron = require('node-cron');
const { syncEquipes } = require('./scheduler');
const { listTeams } = require('./pipedrive');

// Valida variáveis obrigatórias
const required = ['PIPEDRIVE_API_TOKEN', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERRO: Variável de ambiente obrigatória não definida: ${key}`);
    process.exit(1);
  }
}

console.log('===========================================');
console.log('  Pipedrive Escala — iniciando...');
console.log('===========================================');
console.log(`Timezone: ${process.env.TIMEZONE || 'America/Sao_Paulo'}`);
console.log(`Reset diário às: ${process.env.RESET_HOUR || '8'}:00`);
console.log('');

// Roda imediatamente ao iniciar
syncEquipes().catch(err => console.error('[Main] Erro no sync inicial:', err));

// Cron: roda a cada 5 minutos
// Isso garante que transições de turno sejam capturadas em até 5 min
cron.schedule('*/5 * * * *', async () => {
  try {
    await syncEquipes();
  } catch (err) {
    console.error('[Main] Erro no sync agendado:', err);
  }
}, {
  timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
});

console.log('Cron agendado: a cada 5 minutos');
console.log('');

// Comando especial: listar equipes do Pipedrive (útil para pegar IDs)
if (process.argv[2] === '--list-teams') {
  listTeams().then(teams => {
    console.log('\n=== EQUIPES NO PIPEDRIVE ===');
    teams.forEach(t => console.log(`ID: ${t.id} | Nome: ${t.name}`));
    process.exit(0);
  });
}
