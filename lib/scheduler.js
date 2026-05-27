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
    dayOfWeek: sp.getDay(), // 0=dom, 1=seg..6=sab
  };
}

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function isOnShift(pessoa, currentMinutes) {
  const entrada = toMinutes(pessoa.entrada);
  const saida   = toMinutes(pessoa.saida);
  if (entrada === null || saida === null) return false;
  return currentMinutes >= entrada && currentMinutes < saida;
}

function groupByTeam(pessoas) {
  const map = {};
  for (const p of pessoas) {
    if (!map[p.equipeId]) map[p.equipeId] = [];
    map[p.equipeId].push(p);
  }
  return map;
}

// Cache de userId por email para reduzir chamadas à API dentro da mesma execução
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
  const isWeekend  = dayOfWeek === 0 || dayOfWeek === 6;
  const isResetTime = !isWeekend && hour === RESET_HOUR && minute < 5;

  const log = [];
  log.push(`[Escala] ${new Date().toLocaleString('pt-BR', { timeZone: TIMEZONE })}`);
  log.push(`[Escala] Dia: ${dayOfWeek} | Fim de semana: ${isWeekend} | Reset 08h: ${isResetTime}`);

  const escala = await getEscala();
  if (!escala.length) {
    log.push('[Escala] AVISO: Nenhum dado encontrado na planilha.');
    return log;
  }

  const escalaComId = await resolveUserIds(escala);
  const porEquipe   = groupByTeam(escalaComId);

  for (const [equipeIdStr, membrosEquipe] of Object.entries(porEquipe)) {
    const equipeId   = parseInt(equipeIdStr, 10);
    const equipeNome = membrosEquipe[0]?.equipeNome || String(equipeId);

    log.push(`\n--- Equipe: ${equipeNome} (id: ${equipeId}) ---`);

    // FIM DE SEMANA: todos entram
    if (isWeekend) {
      const todosIds = membrosEquipe.map(p => p.userId);
      const atuais   = await getTeamMembers(equipeId);
      const faltando = todosIds.filter(id => !atuais.includes(id));
      if (faltando.length > 0) {
        log.push(`Fim de semana — adicionando ${faltando.length} pessoa(s)`);
        await addTeamMembers(equipeId, faltando);
      } else {
        log.push(`Fim de semana — todos ja estao na equipe`);
      }
      continue;
    }

    // RESET 08h: limpa e adiciona turno atual
    if (isResetTime) {
      const atuais = await getTeamMembers(equipeId);
      if (atuais.length > 0) {
        log.push(`Reset 08h — removendo ${atuais.length} membro(s)`);
        await removeTeamMembers(equipeId, atuais);
      }
      const turnoAtual = membrosEquipe.filter(p => isOnShift(p, currentMinutes));
      if (turnoAtual.length > 0) {
        const ids = turnoAtual.map(p => p.userId);
        log.push(`Reset 08h — adicionando ${ids.length} pessoa(s) do turno`);
        await addTeamMembers(equipeId, ids);
      } else {
        log.push(`Ninguem no turno as 08h — fallback: adicionando todos`);
        await addTeamMembers(equipeId, membrosEquipe.map(p => p.userId));
      }
      continue;
    }

    // HORÁRIO NORMAL Seg-Sex
    const turnoAtual    = membrosEquipe.filter(p => isOnShift(p, currentMinutes));
    const atuais        = await getTeamMembers(equipeId);

    if (turnoAtual.length === 0) {
      log.push(`Ninguem na escala agora — fallback: adicionando todos`);
      const faltando = membrosEquipe.map(p => p.userId).filter(id => !atuais.includes(id));
      if (faltando.length > 0) await addTeamMembers(equipeId, faltando);
      continue;
    }

    const turnoIds      = turnoAtual.map(p => p.userId);
    const paraRemover   = atuais.filter(id => !turnoIds.includes(id));
    const paraAdicionar = turnoIds.filter(id => !atuais.includes(id));

    if (paraRemover.length > 0) {
      log.push(`Removendo ${paraRemover.length} pessoa(s) fora do turno`);
      await removeTeamMembers(equipeId, paraRemover);
    }
    if (paraAdicionar.length > 0) {
      log.push(`Adicionando ${paraAdicionar.length} pessoa(s) no turno`);
      await addTeamMembers(equipeId, paraAdicionar);
    }
    if (paraRemover.length === 0 && paraAdicionar.length === 0) {
      log.push(`Equipe ja esta correta`);
    }
  }

  log.push('\n[Escala] Sync concluido');
  return log;
}

module.exports = { syncEquipes };
