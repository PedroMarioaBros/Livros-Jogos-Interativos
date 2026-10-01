import { rollDie } from "./dice.js";

function getMagic(character) {
  if (!character?.stats || !("magia" in character.stats)) {
    throw new Error("O personagem não possui o atributo MAGIA.");
  }
  return character.stats.magia;
}

function spendMagic(character, amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("Custo de MAGIA inválido.");
  }

  if (getMagic(character) < amount) {
    return false;
  }

  character.stats.magia -= amount;
  return true;
}

export function combatSpellLimit(character) {
  return character?.flags?.includes("dois_feiticos_de_combate")
    ? 2
    : 1;
}

export function castCombatSpell(character, spell, encounter, options = {}) {
  if (!encounter || typeof encounter !== "object") {
    throw new Error("O encontro de combate é obrigatório.");
  }

  const attempts = Number(
    encounter.combatSpellsAttempted ??
    (encounter.combatSpellAttempted ? 1 : 0)
  );
  const limit = combatSpellLimit(character);

  if (attempts >= limit) {
    return {
      ok: false,
      reason: "combat-spell-limit-reached",
      attempts,
      limit
    };
  }

  const rng = options.rng || Math.random;
  let cost = spell.cost;

  if (cost === "variable") {
    cost = Number(options.magicSpend);
    if (!Number.isInteger(cost) || cost <= 0) {
      return { ok: false, reason: "invalid-variable-cost" };
    }
    if (spell.id === "recuperacao" && cost % 3 !== 0) {
      return { ok: false, reason: "recovery-cost-must-be-multiple-of-3" };
    }
  }

  if (getMagic(character) === 0 || !spendMagic(character, cost)) {
    return { ok: false, reason: "insufficient-magic" };
  }

  encounter.combatSpellsAttempted = attempts + 1;
  encounter.combatSpellAttempted = true;

  const die = rollDie(6, rng);
  const success = die < 6;
  const result = {
    ok: true,
    success,
    die,
    cost,
    magicAfter: character.stats.magia,
    attempts: encounter.combatSpellsAttempted,
    limit,
    effect: success ? spell.effect : null
  };

  if (success && spell.id === "recuperacao") {
    const recovered = Math.floor((cost / 3) * 2);
    const before = character.stats.energia;
    character.stats.energia = Math.min(
      character.initialStats.energia,
      character.stats.energia + recovered
    );
    result.recoveredEnergy = character.stats.energia - before;
  }

  return result;
}

export function castSituationalSpell(character, option, rng = Math.random) {
  const cost = Number(option.cost);

  if (getMagic(character) === 0) {
    return {
      ok: true,
      success: false,
      automaticFailure: true,
      die: null,
      cost: 0,
      magicAfter: 0,
      target: option.failureTarget
    };
  }

  if (!spendMagic(character, cost)) {
    return {
      ok: false,
      reason: "insufficient-magic",
      target: null
    };
  }

  const die = rollDie(6, rng);
  const success = die < 6;

  return {
    ok: true,
    success,
    die,
    cost,
    magicAfter: character.stats.magia,
    target: success ? option.successTarget : option.failureTarget
  };
}
