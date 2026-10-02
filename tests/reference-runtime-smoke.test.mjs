import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createCharacter } from "../src/engine/character.js";
import {
  applyEffects,
  availableChoices,
  conditionMet,
  resolveDynamicDuoComparison,
  resolveConditionalEncounterModifiers,
  resolveConditionalEncounterEnemies
} from "../src/engine/story.js";

const COMPLETE_STATES = new Set([
  "extraida",
  "validada",
  "implementada",
  "testada"
]);

function constantRng() {
  return 0.25;
}

const [colthar, lothar, game] = await Promise.all([
  fs.readFile(
    new URL(
      "../jogos/furia-de-principes/data/colthar.json",
      import.meta.url
    ),
    "utf8"
  ).then(JSON.parse),
  fs.readFile(
    new URL(
      "../jogos/furia-de-principes/data/lothar.json",
      import.meta.url
    ),
    "utf8"
  ).then(JSON.parse),
  fs.readFile(
    new URL(
      "../jogos/furia-de-principes/game.json",
      import.meta.url
    ),
    "utf8"
  ).then(JSON.parse)
]);

const books = { colthar, lothar };

function otherCharacter(character) {
  return character === "colthar" ? "lothar" : "colthar";
}

function createContext(characterId) {
  const character = createCharacter(
    books[characterId],
    constantRng
  );
  const partnerCharacter = createCharacter(
    books[otherCharacter(characterId)],
    constantRng
  );

  return {
    character,
    partnerCharacter,
    partnerActive: true,
    shared: { status: 0, acao: 0 },
    itemTags: game.itemTags || {},
    sharedGoldSufficient: true,
    pendingSharedLoot: null
  };
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

function assertEffectsSupported(
  characterId,
  reference,
  effects,
  label
) {
  if (!effects?.length) return 0;

  const context = createContext(characterId);
  const results = applyEffects(
    context.character,
    effects,
    context,
    constantRng
  );

  results.forEach((result, index) => {
    assert.notEqual(
      result?.unsupported,
      true,
      `${characterId} ${reference}: ${label}[${index}] retornou unsupported`
    );
  });

  return effects.length;
}

test("runtime executa todas as referências completas sem recurso unsupported", () => {
  let completeReferences = 0;
  let effectInstances = 0;
  let conditionInstances = 0;

  for (const [characterId, book] of Object.entries(books)) {
    for (
      const [reference, node] of
      Object.entries(book.references || {})
    ) {
      if (!COMPLETE_STATES.has(node.estado)) continue;

      completeReferences += 1;

      {
        const context = createContext(characterId);

        assert.doesNotThrow(
          () => availableChoices(node, context),
          `${characterId} ${reference}: falha ao avaliar escolhas`
        );

        if (node.encounter) {
          assert.doesNotThrow(
            () => resolveConditionalEncounterModifiers(
              node.encounter,
              context
            ),
            `${characterId} ${reference}: falha em modificadores condicionais`
          );
          assert.doesNotThrow(
            () => resolveConditionalEncounterEnemies(
              node.encounter,
              context
            ),
            `${characterId} ${reference}: falha em inimigos condicionais`
          );
        }

        if (node.dynamicDuoComparison) {
          const result = resolveDynamicDuoComparison(
            node.dynamicDuoComparison,
            context.character,
            context.partnerCharacter
          );
          assert.ok(
            result && Number.isInteger(Number(result.target)),
            `${characterId} ${reference}: comparação dinâmica sem destino`
          );
        }

        const conditions = collectConditions(node);
        conditionInstances += conditions.length;

        for (const [index, condition] of conditions.entries()) {
          assert.doesNotThrow(
            () => conditionMet(condition, context),
            `${characterId} ${reference}: condição ${index} lançou exceção`
          );
        }
      }

      effectInstances += assertEffectsSupported(
        characterId,
        reference,
        node.effects || [],
        "effects"
      );

      effectInstances += assertEffectsSupported(
        characterId,
        reference,
        node.rewards || [],
        "rewards"
      );

      for (const [choiceIndex, choice] of (node.choices || []).entries()) {
        effectInstances += assertEffectsSupported(
          characterId,
          reference,
          choice.effects || [],
          `choices[${choiceIndex}].effects`
        );
      }
    }
  }

  assert.equal(completeReferences, 989);
  assert.equal(effectInstances, 335);
  assert.equal(conditionInstances, 178);
});
