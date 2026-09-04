const { getEscala } = require('./sheets');
const { getUserIdByEmail, getTeamMembers, addTeamMembers, removeTeamMembers } = require('./pipedrive');

const TIMEZONE   = process.env.TIMEZONE || 'America/Sao_Paulo';
const RESET_HOUR = parseInt(process.env.RESET_HOUR || '8', 10);

function getNowSP() {
  const now   = new Date();
  const spStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const sp    = new Date(spStr);
  return {
    hour:      sp.getHours(),
    minute:    sp.getMinutes(),
    dayOfWeek: sp.getDay(), // 0=Dom, 1=Seg..6=Sab
  };
}

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function isOnShift(pessoa, currentMinutes, dayOfWeek) {
  // Verifica dia da semana (null = todos os dias)
  if (pessoa.dias !== null && !pessoa.dias.includes(dayOfWeek)) return false;

  const entrada = toMinutes(pessoa.entrada);
  const saida   = toMinutes(pessoa.saida);
  if (entrada === null || saida === null) return false;
  return currentMinutes >= entrada && currentMinutes < saida;
}

/**
 * Verifica se a pessoa deve ser considerada hoje (dia da semana)
 * null = todos os dias
 */
function isActiveToday(pessoa, dayOfWeek) {
  if (pessoa.dias === null) return true;
  return pessoa.dias.includes(dayOfWeek);
}

function groupByTeam(pessoas) {
  const map = {};
  for (const p of pessoas) {
    if (!map[p.equipeId]) map[p.equipeId] = [];
    map[p.equipeId].push(p);
  }
  return map;
}

const userIdCache = {};

async function resolveUserId(email) {
  if (userIdCache[email]) return userIdCache[email];
  const id = await getUserIdByEmail(email);
  if (id) userIdCache[email] = id;
  return id;
}

async function resolveUserIds(pessoas) {
  const result = [];
  for (const p of pessoas) {
    const id = await resolveUserId(p.email);
    if (id) {
      result.push({ ...p, userId: id });
    } else {
      console.warn(`[Escala] AVISO: Usuário não encontrado no Pipedrive: ${p.email} (${p.nome})`);
    }
  }
  return result;
}

async function syncEquipes() {
  const { hour, minute, dayOfWeek } = getNowSP();
  const currentMinutes = hour * 60 + minute;
  const isWeekend   = dayOfWeek === 0 || dayOfWeek === 6;
  const isResetTime = !isWeekend && hour === RESET_HOUR && minute < 10;

  console.log(`\n========================================`);
  console.log(`[Escala] ${new Date().toLocaleString('pt-BR', { timeZone: TIMEZONE })}`);
  console.log(`[Escala] Dia: ${dayOfWeek} | Fim de semana: ${isWeekend} | Reset 08h: ${isResetTime}`);
  console.log(`========================================`);

  const escala = await getEscala();
  if (!escala.length) {
    console.log('[Escala] AVISO: Nenhum SDR encontrado na planilha.');
    return;
  }

  const escalaComId = await resolveUserIds(escala);
  const porEquipe   = groupByTeam(escalaComId);

  for (const [equipeIdStr, membrosEquipe] of Object.entries(porEquipe)) {
    const equipeId   = parseInt(equipeIdStr, 10);
    const equipeNome = membrosEquipe[0]?.equipeNome || String(equipeId);

    console.log(`\n--- Equipe: ${equipeNome} (id: ${equipeId}) ---`);

    // Filtra quem é válido HOJE (considera dias_semana)
    const ativosHoje = membrosEquipe.filter(p => isActiveToday(p, dayOfWeek));
    console.log(`[Escala] SDRs ativos hoje (${ativosHoje.length}): ${ativosHoje.map(p => p.nome).join(', ')}`);

    // FIM DE SEMANA: todos os SDRs ativos hoje entram
    if (isWeekend) {
      const todosIds = ativosHoje.map(p => p.userId);
      const atuais   = await getTeamMembers(equipeId);
      console.log(`[Escala] Na equipe agora (${atuais.length}): ${JSON.stringify(atuais)}`);
      const faltando = todosIds.filter(id => !atuais.includes(id));
      // Remove quem nao deveria estar hoje
      const paraRemover = atuais.filter(id => !todosIds.includes(id));
      if (paraRemover.length > 0) await removeTeamMembers(equipeId, paraRemover);
      if (faltando.length > 0) {
        console.log(`[Escala] Fim de semana — adicionando ${faltando.length} SDR(s)`);
        await addTeamMembers(equipeId, faltando);
      } else {
        console.log(`[Escala] Fim de semana — todos SDRs ja estao na equipe`);
      }
      continue;
    }

    // RESET 08h: limpa e adiciona turno atual
    if (isResetTime) {
      const atuais = await getTeamMembers(equipeId);
      if (atuais.length > 0) {
        console.log(`[Escala] Reset 08h — removendo ${atuais.length} membro(s)`);
        await removeTeamMembers(equipeId, atuais);
      }
      const turnoAtual = ativosHoje.filter(p => isOnShift(p, currentMinutes, dayOfWeek));
      console.log(`[Escala] No turno agora (${turnoAtual.length}): ${turnoAtual.map(p => `${p.nome} (${p.entrada}-${p.saida})`).join(', ') || 'ninguem'}`);
      if (turnoAtual.length > 0) {
        await addTeamMembers(equipeId, turnoAtual.map(p => p.userId));
      } else {
        console.log(`[Escala] Ninguem no turno — fallback: adicionando todos SDRs ativos hoje`);
        await addTeamMembers(equipeId, ativosHoje.map(p => p.userId));
      }
      continue;
    }

    // HORÁRIO NORMAL Seg-Sex
    const turnoAtual = ativosHoje.filter(p => isOnShift(p, currentMinutes, dayOfWeek));
    const atuais     = await getTeamMembers(equipeId);

    console.log(`[Escala] No turno agora (${turnoAtual.length}): ${turnoAtual.map(p => `${p.nome} (${p.entrada}-${p.saida})`).join(', ') || 'ninguem'}`);
    console.log(`[Escala] Na equipe agora (${atuais.length}): ${JSON.stringify(atuais)}`);

    if (turnoAtual.length === 0) {
      // Fora do horário — todos os SDRs ativos hoje entram
      console.log(`[Escala] Ninguem na escala agora — todos SDRs ativos hoje entram`);
      const todosAtivosIds = ativosHoje.map(p => p.userId);
      const faltando = todosAtivosIds.filter(id => !atuais.includes(id));
      // Remove quem nao deveria estar hoje
      const paraRemover = atuais.filter(id => !todosAtivosIds.includes(id));
      if (paraRemover.length > 0) await removeTeamMembers(equipeId, paraRemover);
      if (faltando.length > 0) await addTeamMembers(equipeId, faltando);
      continue;
    }

    const turnoIds      = turnoAtual.map(p => p.userId);
    const paraRemover   = atuais.filter(id => !turnoIds.includes(id));
    const paraAdicionar = turnoIds.filter(id => !atuais.includes(id));

    if (paraRemover.length > 0) {
      console.log(`[Escala] Removendo ${paraRemover.length} SDR(s) fora do turno`);
      await removeTeamMembers(equipeId, paraRemover);
    }
    if (paraAdicionar.length > 0) {
      console.log(`[Escala] Adicionando ${paraAdicionar.length} SDR(s) no turno`);
      await addTeamMembers(equipeId, paraAdicionar);
    }
    if (paraRemover.length === 0 && paraAdicionar.length === 0) {
      console.log(`[Escala] Equipe ja esta correta`);
    }
  }

  console.log('\n[Escala] Sync concluido\n');
}

module.exports = { syncEquipes };
