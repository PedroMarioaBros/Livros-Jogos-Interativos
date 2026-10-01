import { rollDie, rollExpression } from "./dice.js";
import { castCombatSpell } from "./magic.js";
import { currentOpponent, encounterStatus } from "./encounter.js";

function clamp(value, minimum = 0) {
  return Math.max(minimum, Number(value));
}

function ensureModifiers(encounter) {
  encounter.modifiers ||= {
    heroSkill: 0,
    enemySkill: 0,
    heroDamage: 2,
    incomingDamage: 2,
    incomingHitSave: null,
    allyHeroSkill: 0
  };
  return encounter.modifiers;
}

export function applyCombatSpell(
  character,
  encounter,
  spell,
  options = {}
) {
  const cast = castCombatSpell(character, spell, encounter, options);
  const result = {
    ...cast,
    spellId: spell.id,
    spellName: spell.name,
    details: []
  };

  if (!cast.ok || !cast.success) {
    return result;
  }

  const effect = spell.effect || {};
  const modifiers = ensureModifiers(encounter);
  const opponent = currentOpponent(encounter);
  const rng = options.rng || Math.random;

  switch (effect.type) {
    case "set-enemy-energy-ratio":
      if (opponent) {
        const before = opponent.energia;
        opponent.energia = Math.ceil(
          opponent.initialEnergy * Number(effect.ratio)
        );
        result.details.push({
          enemy: opponent.name,
          before,
          after: opponent.energia
        });
      }
      break;

    case "enemy-skill-delta":
      if (opponent) {
        const before = opponent.habilidade;
        opponent.habilidade = clamp(
          opponent.habilidade + Number(effect.value)
        );
        result.details.push({
          enemy: opponent.name,
          before,
          after: opponent.habilidade
        });
      }
      break;

    case "enemy-energy-damage":
      if (opponent) {
        const roll = rollExpression(effect.dice, rng);
        const before = opponent.energia;
        opponent.energia = clamp(opponent.energia - roll.total);
        result.details.push({
          enemy: opponent.name,
          roll,
          before,
          after: opponent.energia
        });
      }
      break;

    case "all-enemies-delta":
      for (const enemy of encounter.enemies) {
        const before = {
          habilidade: enemy.habilidade,
          energia: enemy.energia
        };
        enemy.habilidade = clamp(
          enemy.habilidade + Number(effect.habilidade || 0)
        );
        enemy.energia = clamp(
          enemy.energia + Number(effect.energia || 0)
        );
        result.details.push({
          enemy: enemy.name,
          before,
          after: {
            habilidade: enemy.habilidade,
            energia: enemy.energia
          }
        });
      }
      break;

    case "sleep-check-per-enemy":
      for (const enemy of encounter.enemies) {
        if (enemy.energia <= 0) continue;

        const rolls = [];
        for (let i = 0; i < enemy.energia; i += 1) {
          rolls.push(rollDie(6, rng));
        }

        const failed = rolls.includes(Number(effect.failsIfAnyDieIs));
        if (!failed) {
          enemy.asleep = true;
          enemy.energia = 0;
        }

        result.details.push({
          enemy: enemy.name,
          rolls,
          asleep: !failed
        });
      }
      break;

    case "incoming-hit-save":
      modifiers.incomingHitSave = {
        noDamageResults: [...(effect.noDamageResults || [])],
        normalDamageResults: [...(effect.normalDamageResults || [])]
      };
      break;

    case "set-incoming-damage":
      modifiers.incomingDamage = Number(effect.value);
      break;

    case "set-outgoing-damage":
      modifiers.heroDamage = Number(effect.value);
      break;

    case "hero-skill-delta":
      modifiers.heroSkill += Number(effect.value);
      break;

    case "hero-and-ally-skill-delta":
      modifiers.heroSkill += Number(effect.value);
      modifiers.allyHeroSkill += Number(effect.value);
      break;

    case "combat-proxy":
      encounter.proxy = {
        name: "Sombra",
        initialStats: {
          habilidade: Number(effect.habilidade),
          energia: Number(effect.energia)
        },
        stats: {
          habilidade: Number(effect.habilidade),
          energia: Number(effect.energia)
        }
      };
      break;

    case "convert-magic-to-energy":
      // Recuperação já é aplicada por castCombatSpell.
      break;

    default:
      result.unsupportedEffect = effect.type || null;
  }

  const status = encounterStatus(encounter, character);
  result.encounterFinished = status.finished;
  result.encounterVictory = status.victory;
  result.encounterDefeat = status.defeat;

  return result;
}
