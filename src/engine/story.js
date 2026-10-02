import { modifyStat } from "./character.js";
import { rollExpression } from "./dice.js";

function hasItem(character, item) {
  return character.items.includes(item);
}

export function countItem(character, item) {
  return (character?.items || []).filter(entry => entry === item).length;
}

function isStackableItem(item, context = {}) {
  return (context.itemTags?.stackable || []).includes(item);
}

export function resolveDynamicDuoComparison(
  comparison,
  character,
  partnerCharacter
) {
  if (!comparison || !character || !partnerCharacter) return null;

  const resource = comparison.resource;
  const selfCount = countItem(character, resource);
  const partnerCount = countItem(partnerCharacter, resource);

  if (selfCount > partnerCount) {
    return {
      target: comparison.selfGreaterTarget,
      selfCount,
      partnerCount,
      outcome: "self-greater"
    };
  }

  if (partnerCount > selfCount) {
    return {
      target: comparison.partnerGreaterTarget,
      selfCount,
      partnerCount,
      outcome: "partner-greater"
    };
  }

  return {
    target: comparison.equalTarget,
    selfCount,
    partnerCount,
    outcome: "equal"
  };
}

function hasFlag(character, flag) {
  return character.flags.includes(flag);
}

function hasTaggedItem(character, context, tag) {
  const tagged = new Set(context.itemTags?.[tag] || []);
  return character.items.some(item => tagged.has(item));
}

export function resolveTemporaryEffects(character, context = {}) {
  character.temporaryEffects ||= [];
  const remaining = [];
  const resolved = [];

  for (const temporary of character.temporaryEffects) {
    const shouldResolve =
      temporary.until === "has_weapon" &&
      hasTaggedItem(character, context, "weapons");

    if (!shouldResolve) {
      remaining.push(temporary);
      continue;
    }

    const before = character.stats[temporary.stat];
    const value = modifyStat(
      character,
      temporary.stat,
      -Number(temporary.delta || 0)
    );

    resolved.push({
      ...temporary,
      before,
      value
    });
  }

  character.temporaryEffects = remaining;
  return resolved;
}

export function conditionMet(condition, context) {
  const { character, shared = {}, partnerActive = false } = context;

  switch (condition.type) {
    case "flag":
      return hasFlag(character, condition.flag);
    case "flag_not":
      return !hasFlag(character, condition.flag);
    case "flag_any":
      return (condition.flags || []).some(flag => hasFlag(character, flag));
    case "gold_gte":
      return character.gold >= Number(condition.value);
    case "has_item":
      return hasItem(character, condition.item);
    case "not_has_item":
      return !hasItem(character, condition.item);
    case "partner_active":
      return Boolean(partnerActive);
    case "partner_removed":
      return !partnerActive;
    case "shared_equals":
      return shared[condition.key] === condition.value;
    case "shared_not_in":
      return !condition.values.includes(shared[condition.key]);
    case "shared_in":
      return (condition.values || []).includes(shared[condition.key]);
    case "shared_gold_sufficient":
      return Boolean(context.sharedGoldSufficient);
    case "shared_gold_gte": {
      const partnerGold = Number(context.partnerCharacter?.gold || 0);
      return character.gold + partnerGold >= Number(condition.value || 0);
    }
    case "shared_gold_lt": {
      const partnerGold = Number(context.partnerCharacter?.gold || 0);
      return character.gold + partnerGold < Number(condition.value || 0);
    }
    default:
      return false;
  }
}

export function resolveConditionalEncounterModifiers(
  definition,
  context
) {
  const merged = {
    ...(definition?.modifiers || {})
  };

  for (const rule of definition?.conditionalModifiers || []) {
    const matches = (rule.conditions || []).every(condition =>
      conditionMet(condition, context)
    );

    if (!matches) continue;

    for (const [key, value] of Object.entries(rule.modifiers || {})) {
      if (
        typeof value === "number" &&
        typeof merged[key] === "number"
      ) {
        merged[key] += value;
      } else if (
        typeof value === "number" &&
        merged[key] === undefined
      ) {
        merged[key] = value;
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

export function choiceAvailable(choice, context) {
  return (choice.conditions || []).every(condition =>
    conditionMet(condition, context)
  );
}

export function availableChoices(node, context) {
  return (node.choices || []).filter(choice =>
    choiceAvailable(choice, context)
  );
}

export function applyEffect(character, effect, context = {}, rng = Math.random) {
  switch (effect.type) {
    case "clear_items":
      character.items = [];
      return { type: effect.type };

    case "stash_and_clear_items":
      character.stashedItems = [...character.items];
      character.items = [];
      return {
        type: effect.type,
        stashed: [...character.stashedItems]
      };

    case "stash_items_except": {
      const keep = new Set(effect.items || []);
      const removed = character.items.filter(item => !keep.has(item));
      character.stashedItems = [
        ...(character.stashedItems || []),
        ...removed
      ];
      character.items = character.items.filter(item => keep.has(item));
      return {
        type: effect.type,
        stashed: [...removed],
        kept: [...character.items]
      };
    }

    case "restore_stashed_items": {
      const restored = [...(character.stashedItems || [])];
      for (const item of restored) {
        if (!hasItem(character, item)) character.items.push(item);
      }
      character.stashedItems = [];
      const resolvedTemporary = resolveTemporaryEffects(character, context);
      return {
        type: effect.type,
        restored,
        resolvedTemporary
      };
    }

    case "add_item": {
      if (
        isStackableItem(effect.item, context) ||
        !hasItem(character, effect.item)
      ) {
        character.items.push(effect.item);
      }
      const resolvedTemporary = resolveTemporaryEffects(character, context);
      return {
        type: effect.type,
        item: effect.item,
        resolvedTemporary
      };
    }

    case "remove_item":
    case "remove_item_if_present":
      character.items = character.items.filter(item => item !== effect.item);
      return { type: effect.type, item: effect.item };

    case "clear_items_except": {
      const keep = new Set(effect.items || []);
      character.items = character.items.filter(item => keep.has(item));
      return {
        type: effect.type,
        items: [...character.items]
      };
    }

    case "restore_stat_to_initial": {
      if (!(effect.stat in character.stats)) {
        return {
          type: effect.type,
          stat: effect.stat,
          unsupported: true
        };
      }

      const before = character.stats[effect.stat];
      const delta = character.initialStats[effect.stat] - before;
      const value = modifyStat(character, effect.stat, Math.max(0, delta));

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value,
        blocked:
          effect.stat === "energia" &&
          before < character.initialStats[effect.stat] &&
          value === before &&
          character.flags?.includes("sem_recuperacao_energia")
      };
    }

    case "increase_initial_stat": {
      if (!(effect.stat in character.initialStats)) {
        return {
          type: effect.type,
          stat: effect.stat,
          unsupported: true
        };
      }

      const before = character.initialStats[effect.stat];
      character.initialStats[effect.stat] = Math.max(
        0,
        before + Number(effect.delta || 0)
      );

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value: character.initialStats[effect.stat]
      };
    }

    case "add_shared_loot":
      context.pendingSharedLoot = {
        gold: Number(effect.gold || 0),
        items: [...(effect.items || [])]
      };
      return {
        type: effect.type,
        pending: true,
        ...context.pendingSharedLoot
      };

    case "set_gold":
      character.gold = Math.max(0, Number(effect.value) || 0);
      return { type: effect.type, value: character.gold };

    case "change_gold":
      character.gold = Math.max(0, character.gold + Number(effect.delta || 0));
      return { type: effect.type, value: character.gold };

    case "change_provisions":
      character.provisions = Math.max(
        0,
        character.provisions + Number(effect.delta || 0)
      );
      return { type: effect.type, value: character.provisions };

    case "set_provisions":
      character.provisions = Math.max(0, Number(effect.value || 0));
      return { type: effect.type, value: character.provisions };

    case "set_stat": {
      if (!(effect.stat in character.stats)) {
        return {
          type: effect.type,
          stat: effect.stat,
          unsupported: true
        };
      }

      const before = character.stats[effect.stat];
      const maximum = character.initialStats[effect.stat];
      character.stats[effect.stat] = Math.max(
        0,
        Math.min(maximum, Number(effect.value || 0))
      );

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value: character.stats[effect.stat]
      };
    }

    case "change_stat": {
      const delta = Number(effect.delta || 0);

      if (
        effect.temporaryUntil === "has_weapon" &&
        hasTaggedItem(character, context, "weapons")
      ) {
        return {
          type: effect.type,
          stat: effect.stat,
          skipped: true,
          reason: "temporary-condition-already-resolved",
          value: character.stats[effect.stat]
        };
      }

      const before = character.stats[effect.stat];
      const value = modifyStat(
        character,
        effect.stat,
        delta,
        { allowAboveInitial: effect.cap === "none" }
      );

      if (effect.temporaryUntil && value !== before) {
        character.temporaryEffects ||= [];
        const duplicate = character.temporaryEffects.some(
          temporary =>
            temporary.stat === effect.stat &&
            temporary.until === effect.temporaryUntil
        );

        if (!duplicate) {
          character.temporaryEffects.push({
            stat: effect.stat,
            delta: value - before,
            until: effect.temporaryUntil
          });
        }
      }

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value,
        temporaryUntil: effect.temporaryUntil || null
      };
    }

    case "set_partner_resource": {
      const partner = context.partnerCharacter;
      const resource = effect.resource;

      if (
        !partner ||
        !["gold", "provisions"].includes(resource)
      ) {
        return {
          type: effect.type,
          resource,
          unsupported: true
        };
      }

      const before = Number(partner[resource] || 0);
      partner[resource] = Math.max(0, Number(effect.value || 0));

      return {
        type: effect.type,
        resource,
        before,
        value: partner[resource]
      };
    }

    case "change_partner_stat": {
      const partner = context.partnerCharacter;
      if (!partner || !(effect.stat in partner.stats)) {
        return {
          type: effect.type,
          stat: effect.stat,
          unsupported: true
        };
      }

      const before = partner.stats[effect.stat];
      const value = modifyStat(
        partner,
        effect.stat,
        Number(effect.delta || 0),
        { allowAboveInitial: effect.cap === "none" }
      );

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value
      };
    }

    case "random_stat_damage": {
      const roll = rollExpression(effect.dice, rng);
      const before = character.stats[effect.stat];
      const value = modifyStat(
        character,
        effect.stat,
        -roll.total,
        { allowAboveInitial: true }
      );
      return {
        type: effect.type,
        stat: effect.stat,
        roll,
        before,
        value
      };
    }

    case "recover_last_combat_damage_except": {
      const damage = Math.max(0, Number(character.lastCombatDamage || 0));
      const leave = Math.max(0, Number(effect.leave || 0));
      const amount = Math.max(0, damage - leave);
      const before = character.stats[effect.stat];
      const value = modifyStat(
        character,
        effect.stat,
        amount
      );
      return {
        type: effect.type,
        stat: effect.stat,
        damage,
        leave,
        recovered: value - before,
        value
      };
    }

    case "recover_fraction_last_combat_damage": {
      const damage = Math.max(0, Number(character.lastCombatDamage || 0));
      const amount = Math.floor(damage * Number(effect.fraction || 0));
      const before = character.stats[effect.stat];
      const value = modifyStat(
        character,
        effect.stat,
        amount
      );
      return {
        type: effect.type,
        stat: effect.stat,
        damage,
        recovered: value - before,
        value
      };
    }

    case "set_inventory_limit":
      character.inventoryLimit = Number(effect.value);
      character.inventoryLimitExcludes = [...(effect.exclude || [])];
      return {
        type: effect.type,
        value: character.inventoryLimit
      };

    case "set_flag":
      if (!hasFlag(character, effect.flag)) character.flags.push(effect.flag);
      return { type: effect.type, flag: effect.flag };

    case "remove_flag":
      character.flags = character.flags.filter(flag => flag !== effect.flag);
      return { type: effect.type, flag: effect.flag };

    case "set_shared":
      if (context.ignoreSharedMutations) {
        return { type: effect.type, ignored: true };
      }
      if (!context.shared) context.shared = {};
      context.shared[effect.key] = effect.value;
      return {
        type: effect.type,
        key: effect.key,
        value: effect.value
      };

    default:
      return { type: effect.type, unsupported: true };
  }
}

export function applyEffects(character, effects, context = {}, rng = Math.random) {
  return (effects || []).map(effect =>
    applyEffect(character, effect, context, rng)
  );
}
