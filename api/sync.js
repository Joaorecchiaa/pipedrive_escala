const { syncEquipes } = require('../lib/scheduler');

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[API] Iniciando sync...');
    await syncEquipes();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[API] Erro no sync:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
