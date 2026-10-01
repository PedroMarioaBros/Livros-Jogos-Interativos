import { rollDie, rollDice } from "./dice.js";

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

export function resolveSequentialCombat(character, opponents, options = {}) {
  const encounters = [];

  for (let index = 0; index < opponents.length; index += 1) {
    if (character.stats.energia <= 0) break;

    const opponent = opponents[index];
    if (opponent.energia <= 0) continue;

    const result = resolveCombat(character, opponent, options);
    encounters.push({
      opponentIndex: index,
      opponentName: opponent.name,
      ...result
    });

    if (result.winner !== "hero") break;
  }

  const livingEnemies = opponents.filter(enemy => enemy.energia > 0);

  return {
    winner:
      character.stats.energia <= 0
        ? "enemies"
        : livingEnemies.length === 0
          ? "hero"
          : null,
    encounters,
    livingEnemies
  };
}

function livingHeroIndexes(state) {
  return state.heroes
    .map((hero, index) => hero.stats.energia > 0 ? index : -1)
    .filter(index => index >= 0);
}

function livingEnemyIndexes(state) {
  return state.enemies
    .map((enemy, index) => enemy.energia > 0 ? index : -1)
    .filter(index => index >= 0);
}

function refreshCooperativeMode(state, rng = Math.random) {
  const heroes = livingHeroIndexes(state);
  const enemies = livingEnemyIndexes(state);

  if (heroes.length === 0 || enemies.length === 0) {
    state.mode = "finished";
    state.assignments = {};
    return;
  }

  if (heroes.length >= 2 && enemies.length === 1) {
    state.mode = "alternate";
    state.assignments = {
      [heroes[0]]: enemies[0],
      [heroes[1]]: enemies[0]
    };

    if (!heroes.includes(state.alternateHero)) {
      state.alternateHero =
        rollDie(6, rng) <= 3 ? heroes[0] : heroes[1];
    }
    return;
  }

  state.mode = "parallel";
  const assignments = {};
  const freeEnemies = [...enemies];

  for (const heroIndex of heroes) {
    const previous = state.assignments?.[heroIndex];
    if (
      previous !== undefined &&
      freeEnemies.includes(previous) &&
      state.enemies[previous].energia > 0
    ) {
      assignments[heroIndex] = previous;
      freeEnemies.splice(freeEnemies.indexOf(previous), 1);
      continue;
    }

    if (freeEnemies.length > 0) {
      assignments[heroIndex] = freeEnemies.shift();
    }
  }

  state.assignments = assignments;
}

export function createCooperativeCombatState(
  heroes,
  opponents,
  options = {}
) {
  if (!Array.isArray(heroes) || heroes.length !== 2) {
    throw new Error("O combate cooperativo exige exatamente dois heróis.");
  }

  const state = {
    heroes,
    enemies: opponents,
    assignments: {},
    alternateHero: null,
    mode: "parallel",
    step: 0,
    log: []
  };

  refreshCooperativeMode(state, options.rng || Math.random);
  return state;
}

export function cooperativeCombatStep(state, options = {}) {
  const rng = options.rng || Math.random;
  const modifiersByHero = options.modifiersByHero || {};
  const events = [];

  refreshCooperativeMode(state, rng);

  if (state.mode === "finished") {
    return {
      finished: true,
      winner: livingHeroIndexes(state).length > 0 ? "heroes" : "enemies",
      events
    };
  }

  state.step += 1;

  if (state.mode === "alternate") {
    const heroIndexes = livingHeroIndexes(state);
    const enemyIndex = livingEnemyIndexes(state)[0];

    if (!heroIndexes.includes(state.alternateHero)) {
      state.alternateHero =
        rollDie(6, rng) <= 3 ? heroIndexes[0] : heroIndexes[1];
    }

    const heroIndex = state.alternateHero;
    const result = combatRound(
      state.heroes[heroIndex],
      state.enemies[enemyIndex],
      rng,
      modifiersByHero[heroIndex] || {}
    );

    events.push({
      mode: "alternate",
      heroIndex,
      enemyIndex,
      result
    });

    const remainingHeroes = livingHeroIndexes(state);
    if (remainingHeroes.length >= 2) {
      state.alternateHero =
        heroIndex === remainingHeroes[0]
          ? remainingHeroes[1]
          : remainingHeroes[0];
    } else {
      state.alternateHero = remainingHeroes[0] ?? null;
    }
  } else {
    const pairs = Object.entries(state.assignments)
      .map(([heroIndex, enemyIndex]) => ({
        heroIndex: Number(heroIndex),
        enemyIndex: Number(enemyIndex)
      }))
      .filter(({ heroIndex, enemyIndex }) =>
        state.heroes[heroIndex].stats.energia > 0 &&
        state.enemies[enemyIndex].energia > 0
      );

    for (const { heroIndex, enemyIndex } of pairs) {
      const result = combatRound(
        state.heroes[heroIndex],
        state.enemies[enemyIndex],
        rng,
        modifiersByHero[heroIndex] || {}
      );

      events.push({
        mode: "parallel",
        heroIndex,
        enemyIndex,
        result
      });
    }
  }

  state.log.push({ step: state.step, events });
  refreshCooperativeMode(state, rng);

  const heroesAlive = livingHeroIndexes(state);
  const enemiesAlive = livingEnemyIndexes(state);
  const finished = heroesAlive.length === 0 || enemiesAlive.length === 0;

  return {
    finished,
    winner:
      !finished ? null : enemiesAlive.length === 0 ? "heroes" : "enemies",
    mode: state.mode,
    events,
    heroesAlive,
    enemiesAlive
  };
}

export function resolveCooperativeCombat(
  heroes,
  opponents,
  options = {}
) {
  const state = createCooperativeCombatState(heroes, opponents, options);
  const maxSteps = options.maxSteps || 200;

  for (let step = 0; step < maxSteps; step += 1) {
    const result = cooperativeCombatStep(state, options);
    if (result.finished) {
      return { ...result, state };
    }
  }

  return {
    finished: false,
    winner: null,
    reason: "max-steps",
    state
  };
}
