import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);

const COMPLETE_STATES = new Set([
  "extraida",
  "validada",
  "implementada",
  "testada"
]);

const SUPPORTED_NODE_KEYS = new Set([
  "afterDeathReference",
  "choices",
  "dynamicCondition",
  "dynamicDuoComparison",
  "effects",
  "encounter",
  "encounterDynamic",
  "encounterSpecial",
  "ending",
  "failureChoices",
  "failureTarget",
  "merchant",
  "onDefeat",
  "onRoundLimit",
  "onVictory",
  "partnerInstruction",
  "partnerOnDefeat",
  "partnerOnFailure",
  "partnerOnVictory",
  "partnerOutcomeRoutes",
  "partnerRemoved",
  "partnerRemovedOnDefeat",
  "partnerRollRoutes",
  "playerEffectChoice",
  "postVictoryChoices",
  "referenceInput",
  "rewards",
  "roll",
  "rollAgainstStat",
  "spellOptions",
  "test"
]);

const METADATA_KEYS = new Set([
  "estado",
  "resumo",
  "notes"
]);

const SUPPORTED_EFFECT_TYPES = new Set([
  "add_item",
  "add_shared_loot",
  "change_gold",
  "change_partner_stat",
  "change_stat",
  "clear_items",
  "clear_items_except",
  "increase_initial_stat",
  "random_stat_damage",
  "recover_fraction_last_combat_damage",
  "recover_last_combat_damage_except",
  "remove_flag",
  "remove_item",
  "remove_item_if_present",
  "restore_stashed_items",
  "restore_stat_to_initial",
  "set_flag",
  "set_gold",
  "set_inventory_limit",
  "set_partner_resource",
  "set_provisions",
  "set_shared",
  "set_stat",
  "stash_and_clear_items",
  "stash_and_clear_partner_items"
]);

const SUPPORTED_CONDITION_TYPES = new Set([
  "flag",
  "flag_any",
  "flag_not",
  "gold_gte",
  "has_any_item",
  "has_item",
  "not_has_item",
  "partner_active",
  "partner_flag_not",
  "partner_removed",
  "shared_equals",
  "shared_gold_gte",
  "shared_gold_lt",
  "shared_in",
  "shared_not_in"
]);

const SUPPORTED_PARTNER_OUTCOMES = new Set([
  "partner_defeated",
  "partner_victory"
]);

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function otherCharacter(character) {
  return character === "colthar" ? "lothar" : "colthar";
}

function collectEffects(node) {
  const effects = [
    ...(node.effects || []),
    ...(node.rewards || [])
  ];

  for (const choice of node.choices || []) {
    effects.push(...(choice.effects || []));
  }

  return effects;
}

function collectConditions(node) {
  const conditions = [];

  for (const choice of node.choices || []) {
    conditions.push(...(choice.conditions || []));
  }

  conditions.push(...(node.encounter?.conditions || []));
  conditions.push(...(node.roll?.conditions || []));

  for (
    const rule of
    node.encounter?.conditionalModifiers || []
  ) {
    conditions.push(...(rule.conditions || []));
  }

  for (
    const rule of
    node.encounter?.conditionalEnemyRemovals || []
  ) {
    conditions.push(...(rule.conditions || []));
  }

  for (const effect of node.effects || []) {
    conditions.push(...(effect.conditions || []));
  }

  for (
    const route of
    node.partnerInstruction?.conditionalSend || []
  ) {
    if (route.condition) conditions.push(route.condition);
  }

  if (node.dynamicCondition) {
    conditions.push(node.dynamicCondition);
  }

  return conditions;
}

const [colthar, lothar, syncData] = await Promise.all([
  readJSON(
    "jogos/furia-de-principes/data/colthar.json"
  ),
  readJSON(
    "jogos/furia-de-principes/data/lothar.json"
  ),
  readJSON(
    "jogos/furia-de-principes/data/sincronizacao.json"
  )
]);

const books = { colthar, lothar };
const issues = [];
const stats = {
  completeReferences: 0,
  effectInstances: 0,
  conditionInstances: 0,
  partnerOutcomeRoutes: 0,
  afterDeathTransitions: 0,
  coordinatedChoices: 0
};

for (const [character, book] of Object.entries(books)) {
  const refs = book.references || {};
  const partnerRefs =
    books[otherCharacter(character)].references || {};

  for (const [refText, node] of Object.entries(refs)) {
    if (!COMPLETE_STATES.has(node.estado)) continue;

    const reference = Number(refText);
    stats.completeReferences += 1;

    for (const key of Object.keys(node)) {
      if (
        METADATA_KEYS.has(key) ||
        SUPPORTED_NODE_KEYS.has(key)
      ) {
        continue;
      }

      issues.push(
        `${character} ${reference}: recurso completo sem suporte declarado: ${key}`
      );
    }

    for (const effect of collectEffects(node)) {
      stats.effectInstances += 1;

      if (!SUPPORTED_EFFECT_TYPES.has(effect.type)) {
        issues.push(
          `${character} ${reference}: efeito sem suporte: ${effect.type}`
        );
      }
    }

    for (const condition of collectConditions(node)) {
      stats.conditionInstances += 1;

      if (!SUPPORTED_CONDITION_TYPES.has(condition.type)) {
        issues.push(
          `${character} ${reference}: condição sem suporte: ${condition.type}`
        );
      }
    }

    for (const choice of node.choices || []) {
      if (choice.partnerTarget === undefined) continue;

      stats.coordinatedChoices += 1;
      const target = Number(choice.partnerTarget);

      if (
        !Number.isInteger(target) ||
        target < 1 ||
        target > 500 ||
        !partnerRefs[String(target)]
      ) {
        issues.push(
          `${character} ${reference}: partnerTarget inválido ${choice.partnerTarget}`
        );
      }
    }

    for (const route of node.partnerOutcomeRoutes || []) {
      stats.partnerOutcomeRoutes += 1;

      if (!SUPPORTED_PARTNER_OUTCOMES.has(route.condition)) {
        issues.push(
          `${character} ${reference}: resultado de parceiro sem suporte: ${route.condition}`
        );
      }

      const target = Number(route.target);
      if (
        !Number.isInteger(target) ||
        target < 1 ||
        target > 500 ||
        !refs[String(target)]
      ) {
        issues.push(
          `${character} ${reference}: destino de partnerOutcome inválido ${route.target}`
        );
      }
    }

    if (
      node.ending === "removed-transition" &&
      reference !== 39 &&
      node.afterDeathReference === undefined
    ) {
      issues.push(
        `${character} ${reference}: removed-transition sem afterDeathReference`
      );
    }

    if (node.afterDeathReference !== undefined) {
      stats.afterDeathTransitions += 1;

      const target = Number(node.afterDeathReference);
      const syncEntry = (syncData.entries || []).find(
        entry =>
          entry.character === character &&
          Number(entry.reference) === target
      );

      if (
        !Number.isInteger(target) ||
        !refs[String(target)] ||
        !syncEntry
      ) {
        issues.push(
          `${character} ${reference}: afterDeathReference ${node.afterDeathReference} sem transição catalogada`
        );
      }
    }
  }
}

const report = {
  ...stats,
  supportedNodeFeatures: SUPPORTED_NODE_KEYS.size,
  supportedEffectTypes: SUPPORTED_EFFECT_TYPES.size,
  supportedConditionTypes: SUPPORTED_CONDITION_TYPES.size,
  issues
};

console.log(JSON.stringify(report, null, 2));

if (issues.length > 0) {
  process.exit(1);
}
