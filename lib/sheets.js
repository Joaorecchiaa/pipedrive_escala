const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function getNowSP() {
  const now   = new Date();
  const spStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const sp    = new Date(spStr);
  return { hour: sp.getHours(), minute: sp.getMinutes() };
}

/**
 * Lê os dados da aba escala_comercial
 * Só bate na planilha quando hour === 7 e minute < 10 (janela das 07:00)
 * Nas demais execuções lê normalmente também (planilha é leve)
 * Filtra apenas SDRs (cargo contém "SDR")
 */
async function getEscala() {
  const { hour, minute } = getNowSP();
  const isReadTime = hour === 7 && minute < 10;

  if (isReadTime) {
    console.log('[Sheets] Leitura diária da planilha (07:00)');
  }

  const auth   = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'escala_comercial!A:H',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const escala = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nome       = (row[0] || '').trim();
    const email      = (row[1] || '').trim();
    const cargo      = (row[3] || '').trim();
    const entrada    = (row[4] || '').trim();
    const saida      = (row[5] || '').trim();
    const equipeNome = (row[6] || '').trim();
    const equipeId   = (row[7] || '').trim();

    // Ignora sem email ou sem id de equipe
    if (!email || !equipeId) continue;

    // Apenas SDRs
    if (!cargo.toUpperCase().includes('SDR')) continue;

    escala.push({
      nome,
      email,
      cargo,
      entrada: entrada || null,
      saida:   saida   || null,
      equipeNome,
      equipeId: parseInt(equipeId, 10),
    });
  }

  console.log(`[Sheets] ${escala.length} SDRs carregados da planilha`);
  return escala;
}

module.exports = { getEscala };
