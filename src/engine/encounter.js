import { createOpponent, combatRound } from "./combat.js";

export function createEncounter(reference, definition) {
  if (!definition?.enemies?.length) {
    throw new Error("O encontro precisa ter pelo menos um inimigo.");
  }

  return {
    reference: Number(reference),
    cooperative: Boolean(definition.cooperative),
    enemies: definition.enemies.map(createOpponent),
    currentEnemyIndex: 0,
    rounds: [],
    finished: false,
    victory: false,
    defeat: false,
    combatSpellAttempted: false,
    modifiers: {
      heroSkill: 0,
      enemySkill: 0,
      heroDamage: 2,
      incomingDamage: 2,
      incomingHitSave: null,
      allyHeroSkill: 0
    },
    proxy: null
  };
}

export function currentOpponent(encounter) {
  if (!encounter) return null;

  while (
    encounter.currentEnemyIndex < encounter.enemies.length &&
    encounter.enemies[encounter.currentEnemyIndex].energia <= 0
  ) {
    encounter.currentEnemyIndex += 1;
  }

  return encounter.enemies[encounter.currentEnemyIndex] || null;
}

export function encounterStatus(encounter, character) {
  const opponent = currentOpponent(encounter);

  if (character.stats.energia <= 0) {
    encounter.finished = true;
    encounter.defeat = true;
    encounter.victory = false;
  } else if (!opponent) {
    encounter.finished = true;
    encounter.victory = true;
    encounter.defeat = false;
  }

  return {
    finished: encounter.finished,
    victory: encounter.victory,
    defeat: encounter.defeat,
    opponent
  };
}

export function playEncounterRound(
  encounter,
  character,
  options = {}
) {
  if (encounter.finished) {
    return {
      ...encounterStatus(encounter, character),
      reason: "encounter-finished"
    };
  }

  const opponent = currentOpponent(encounter);
  if (!opponent) {
    return encounterStatus(encounter, character);
  }

  const activeCharacter =
    encounter.proxy?.stats?.energia > 0
      ? encounter.proxy
      : character;

  const result = combatRound(
    activeCharacter,
    opponent,
    options.rng || Math.random,
    {
      ...(encounter.modifiers || {}),
      ...(options.modifiers || {})
    }
  );

  const usedProxy = activeCharacter !== character;

  const record = {
    round: encounter.rounds.length + 1,
    enemyIndex: encounter.currentEnemyIndex,
    enemyName: opponent.name,
    attackerName: usedProxy ? "Sombra" : character.name,
    usedProxy,
    proxyDefeated:
      usedProxy && activeCharacter.stats.energia <= 0,
    ...result
  };

  encounter.rounds.push(record);

  if (opponent.energia <= 0) {
    encounter.currentEnemyIndex += 1;
  }

  const status = encounterStatus(encounter, character);

  return {
    ...status,
    round: record,
    nextOpponent: status.opponent
  };
}
