import { modifyStat } from "./character.js";
import { rollExpression } from "./dice.js";

function hasItem(character, item) {
  return character.items.includes(item);
}

function hasFlag(character, flag) {
  return character.flags.includes(flag);
}

export function conditionMet(condition, context) {
  const { character, shared = {}, partnerActive = false } = context;

  switch (condition.type) {
    case "flag":
      return hasFlag(character, condition.flag);
    case "flag_not":
      return !hasFlag(character, condition.flag);
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
    case "shared_gold_sufficient":
      return Boolean(context.sharedGoldSufficient);
    default:
      return false;
  }
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
      return {
        type: effect.type,
        restored
      };
    }

    case "add_item":
      if (!hasItem(character, effect.item)) character.items.push(effect.item);
      return { type: effect.type, item: effect.item };

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
      character.stats[effect.stat] = character.initialStats[effect.stat];

      return {
        type: effect.type,
        stat: effect.stat,
        before,
        value: character.stats[effect.stat]
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

    case "change_stat": {
      const before = character.stats[effect.stat];
      const value = modifyStat(
        character,
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
