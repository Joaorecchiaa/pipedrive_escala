const { syncEquipes } = require('../lib/scheduler');

// Vercel Cron Job chama esse endpoint a cada 5 minutos
// Configurado no vercel.json: { "crons": [{ "path": "/api/sync", "schedule": "*/5 * * * *" }] }

module.exports = async function handler(req, res) {
  // Segurança: só aceita chamadas do próprio Vercel Cron ou GET direto
  // O Vercel envia o header authorization automaticamente nas chamadas de cron
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[API] Iniciando sync...');
    const logs = await syncEquipes();
    console.log(logs.join('\n'));
    return res.status(200).json({ ok: true, logs });
  } catch (err) {
    console.error('[API] Erro no sync:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
