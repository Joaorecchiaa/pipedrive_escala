const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/**
 * Lê os dados da aba escala_comercial
 * Colunas: A=Nome, B=Email, C=Subarea, D=Cargo, E=Entrada, F=Saida, G=equipe_distribuicao, H=id_equipe_distribuicao
 * Ignora linhas sem email ou sem id_equipe_distribuicao
 */
async function getEscala() {
  const auth = getAuthClient();
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
    const entrada    = (row[4] || '').trim();
    const saida      = (row[5] || '').trim();
    const equipeNome = (row[6] || '').trim();
    const equipeId   = (row[7] || '').trim();

    if (!email || !equipeId) continue;

    escala.push({
      nome,
      email,
      entrada: entrada || null,
      saida:   saida   || null,
      equipeNome,
      equipeId: parseInt(equipeId, 10),
    });
  }

  return escala;
}

module.exports = { getEscala };
