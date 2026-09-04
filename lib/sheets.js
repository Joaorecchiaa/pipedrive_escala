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

// 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
const DIA_MAP = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3,
  'qui': 4, 'sex': 5, 'sab': 6,
};

function parseDias(diasStr) {
  if (!diasStr || diasStr.trim() === '') return null; // null = todos os dias
  return diasStr
    .split(',')
    .map(d => DIA_MAP[d.trim().toLowerCase()])
    .filter(d => d !== undefined);
}

/**
 * Colunas atuais:
 * A=Nome, B=Email, C=Subarea, D=Cargo, E=Entrada, F=Saida,
 * G=dias_semana, H=equipe_distribuicao, I=id_equipe_distribuicao
 */
async function getEscala() {
  const { hour, minute } = getNowSP();
  if (hour === 7 && minute < 10) {
    console.log('[Sheets] Leitura diária da planilha (07:00)');
  }

  const auth   = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'escala_comercial!A:I',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const escala = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nome       = (row[0] || '').trim(); // A
    const email      = (row[1] || '').trim(); // B
    const cargo      = (row[3] || '').trim(); // D
    const entrada    = (row[4] || '').trim(); // E
    const saida      = (row[5] || '').trim(); // F
    const diasStr    = (row[6] || '').trim(); // G
    const equipeNome = (row[7] || '').trim(); // H
    const equipeId   = (row[8] || '').trim(); // I

    if (!email || !equipeId) continue;
    if (!cargo.toUpperCase().includes('SDR')) continue;

    escala.push({
      nome,
      email,
      cargo,
      entrada: entrada || null,
      saida:   saida   || null,
      dias:    parseDias(diasStr),
      equipeNome,
      equipeId: parseInt(equipeId, 10),
    });
  }

  console.log(`[Sheets] ${escala.length} SDRs carregados da planilha`);
  return escala;
}

module.exports = { getEscala };
