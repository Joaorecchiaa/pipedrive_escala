const axios = require('axios');

const BASE = 'https://api.pipedrive.com/v1';
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;

function headers() {
  return { 'x-api-token': TOKEN, 'Content-Type': 'application/json' };
}

/**
 * Busca o userId do Pipedrive pelo email
 */
async function getUserIdByEmail(email) {
  try {
    const res = await axios.get(`${BASE}/users/find`, {
      params: { term: email, search_by_email: 1 },
      headers: headers(),
    });
    const data = res.data?.data;
    if (data && data.length > 0) return data[0].id;
    return null;
  } catch (err) {
    console.error(`[Pipedrive] Erro ao buscar usuário ${email}:`, err.response?.data || err.message);
    return null;
  }
}

/**
 * Retorna array de userIds que estão atualmente na equipe
 */
async function getTeamMembers(teamId) {
  try {
    const res = await axios.get(`${BASE}/legacyTeams/${teamId}/users`, {
      headers: headers(),
    });
    const data = res.data?.data;
    if (!data) return [];
    // A API retorna array de objetos com id
    return data.map(u => (typeof u === 'object' ? u.id : u));
  } catch (err) {
    console.error(`[Pipedrive] Erro ao listar membros da equipe ${teamId}:`, err.response?.data || err.message);
    return [];
  }
}

/**
 * Adiciona usuários à equipe (ignora IDs já presentes)
 */
async function addTeamMembers(teamId, userIds) {
  if (!userIds || userIds.length === 0) return;
  try {
    await axios.post(
      `${BASE}/legacyTeams/${teamId}/users`,
      { users: userIds },
      { headers: headers() }
    );
    console.log(`[Pipedrive] ✅ Adicionados à equipe ${teamId}:`, userIds);
  } catch (err) {
    console.error(`[Pipedrive] Erro ao adicionar à equipe ${teamId}:`, err.response?.data || err.message);
  }
}

/**
 * Remove usuários da equipe (NÃO deleta do Pipedrive, apenas remove da equipe)
 */
async function removeTeamMembers(teamId, userIds) {
  if (!userIds || userIds.length === 0) return;
  try {
    await axios.delete(`${BASE}/legacyTeams/${teamId}/users`, {
      headers: headers(),
      data: { users: userIds },
    });
    console.log(`[Pipedrive] 🗑️  Removidos da equipe ${teamId}:`, userIds);
  } catch (err) {
    console.error(`[Pipedrive] Erro ao remover da equipe ${teamId}:`, err.response?.data || err.message);
  }
}

/**
 * Lista todas as equipes da conta (útil para pegar IDs)
 */
async function listTeams() {
  try {
    const res = await axios.get(`${BASE}/legacyTeams`, { headers: headers() });
    return res.data?.data || [];
  } catch (err) {
    console.error('[Pipedrive] Erro ao listar equipes:', err.response?.data || err.message);
    return [];
  }
}

module.exports = { getUserIdByEmail, getTeamMembers, addTeamMembers, removeTeamMembers, listTeams };
