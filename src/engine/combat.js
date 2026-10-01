import { rollDice } from "./dice.js";

export function createOpponent({ name, habilidade, energia }) {
  return {
    name,
    habilidade: Number(habilidade),
    energia: Number(energia),
    initialEnergy: Number(energia)
  };
}

export function combatRound(character, opponent, rng = Math.random, modifiers = {}) {
  if (character.stats.energia <= 0 || opponent.energia <= 0) {
    return { finished: true, reason: "combatant-defeated" };
  }

  const enemyRoll = rollDice(2, 6, rng);
  const heroRoll = rollDice(2, 6, rng);

  const enemyAttack =
    enemyRoll.total +
    opponent.habilidade +
    Number(modifiers.enemySkill || 0);

  const heroAttack =
    heroRoll.total +
    character.stats.habilidade +
    Number(modifiers.heroSkill || 0);

  const heroDamage = Number(modifiers.heroDamage ?? 2);
  const incomingDamage = Number(modifiers.incomingDamage ?? 2);

  let outcome = "tie";
  let damage = 0;

  if (heroAttack > enemyAttack) {
    outcome = "hero-hit";
    damage = heroDamage;
    opponent.energia = Math.max(0, opponent.energia - damage);
  } else if (enemyAttack > heroAttack) {
    outcome = "enemy-hit";
    damage = incomingDamage;
    character.stats.energia = Math.max(0, character.stats.energia - damage);
  }

  return {
    finished: character.stats.energia <= 0 || opponent.energia <= 0,
    outcome,
    damage,
    heroAttack,
    enemyAttack,
    heroRolls: heroRoll.rolls,
    enemyRolls: enemyRoll.rolls,
    heroEnergy: character.stats.energia,
    enemyEnergy: opponent.energia
  };
}

export function resolveCombat(character, opponent, options = {}) {
  const rng = options.rng || Math.random;
  const modifiers = options.modifiers || {};
  const maxRounds = options.maxRounds || 100;
  const rounds = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = combatRound(character, opponent, rng, modifiers);
    rounds.push({ round, ...result });

    if (result.finished) {
      return {
        winner: character.stats.energia > 0 ? "hero" : "enemy",
        rounds
      };
    }
  }

  return { winner: null, rounds, reason: "max-rounds" };
}
