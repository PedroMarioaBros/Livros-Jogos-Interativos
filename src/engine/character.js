import { rollExpression } from "./dice.js";

export function createCharacter(data, rng = Math.random) {
  const initialStats = {};

  for (const [stat, expression] of Object.entries(data.initialStats || {})) {
    initialStats[stat] = rollExpression(expression, rng).total;
  }

  const resources = data.startingResources || {};

  return {
    id: data.character,
    name: data.displayName,
    class: data.class,
    initialStats: { ...initialStats },
    stats: { ...initialStats },
    provisions: Number(resources.provisions || 0),
    gold: Number(resources.gold || 0),
    items: [...(resources.items || [])],
    flags: [],
    stashedItems: [],
    lastCombatDamage: 0
  };
}

export function modifyStat(character, stat, delta, options = {}) {
  if (!(stat in character.stats)) {
    throw new Error(`Atributo inexistente: ${stat}`);
  }

  const { allowAboveInitial = false } = options;
  const maximum = allowAboveInitial
    ? Number.POSITIVE_INFINITY
    : character.initialStats[stat];

  const next = Math.max(0, Math.min(maximum, character.stats[stat] + delta));
  character.stats[stat] = next;
  return next;
}

export function consumeProvision(character, context = {}) {
  const blocked = context.inCombat || context.castingSpell || context.hostile;
  if (blocked) {
    return { ok: false, reason: "blocked" };
  }

  if (character.provisions <= 0) {
    return { ok: false, reason: "no-provisions" };
  }

  if (character.stats.energia >= character.initialStats.energia) {
    return { ok: false, reason: "full-energy" };
  }

  character.provisions -= 1;
  const before = character.stats.energia;
  character.stats.energia = Math.min(
    character.initialStats.energia,
    character.stats.energia + 2
  );

  return {
    ok: true,
    restored: character.stats.energia - before,
    provisions: character.provisions
  };
}
