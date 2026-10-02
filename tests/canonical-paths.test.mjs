import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createCharacter } from "../src/engine/character.js";
import {
  applyEffects,
  availableChoices
} from "../src/engine/story.js";
import { processSyncPoint } from "../src/engine/sync.js";

function constantRng() {
  return 0.25;
}

const [colthar, lothar, syncData, game] = await Promise.all([
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
      "../jogos/furia-de-principes/data/sincronizacao.json",
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

const canonicalPaths = {
  colthar: [
    1, 199, 287, 486, 9, 186, 497, 100, 19, 133,
    36, 135, 367, 2, 256, 97, 258, 476, 208, 382,
    101, 432, 137, 296, 217, 493, 381, 255, 373, 282,
    338, 37, 197, 127, 374, 460, 34, 238, 456, 78,
    344, 86, 51, 305, 41, 473, 409, 375, 415, 227,
    111, 319, 99, 181, 31, 44, 311, 465, 454, 500
  ],
  lothar: [
    1, 199, 287, 486, 9, 186, 78, 340, 251, 157,
    328, 430, 52, 119, 499, 367, 2, 167, 205, 187,
    77, 210, 87, 149, 329, 96, 405, 342, 495, 4,
    278, 413, 396, 459, 172, 223, 419, 349, 273, 358,
    451, 490, 282, 398, 194, 385, 31, 44, 18, 454, 500
  ]
};

function otherCharacter(characterId) {
  return characterId === "colthar" ? "lothar" : "colthar";
}

function directTargets(node) {
  const values = [
    node.test?.successTarget,
    node.test?.failureTarget,
    node.onVictory,
    node.onDefeat,
    node.failureTarget,
    node.rollAgainstStat?.successTarget,
    node.rollAgainstStat?.failureTarget,
    node.dynamicCondition?.trueTarget,
    node.dynamicCondition?.falseTarget,
    node.dynamicChoice?.failureTarget,
    node.encounterSpecial?.roundRoll?.target,
    node.encounterSpecial?.onVictory,
    node.playerEffectChoice?.continueTarget,
    node.merchant?.continueTarget,
    node.afterDeathReference
  ];

  for (const route of node.roll?.routes || []) values.push(route.target);
  for (const route of node.partnerRollRoutes || []) values.push(route.target);
  for (const route of node.partnerOutcomeRoutes || []) values.push(route.target);
  for (const option of node.spellOptions || []) values.push(option.successTarget);
  for (const choice of node.failureChoices || []) values.push(choice.target);
  for (const choice of node.postVictoryChoices || []) values.push(choice.target);

  if (node.dynamicDuoComparison) {
    values.push(
      node.dynamicDuoComparison.partnerGreaterTarget,
      node.dynamicDuoComparison.selfGreaterTarget,
      node.dynamicDuoComparison.equalTarget
    );
  }

  return values
    .map(Number)
    .filter(Number.isInteger);
}

function createPathState(characterId) {
  return {
    characterId,
    hero: createCharacter(books[characterId], constantRng),
    partner: createCharacter(
      books[otherCharacter(characterId)],
      constantRng
    ),
    partnerActive: true,
    shared: { status: 0, acao: 0 },
    visited: []
  };
}

function makeContext(state) {
  return {
    character: state.hero,
    partnerCharacter: state.partner,
    partnerActive: state.partnerActive,
    shared: state.shared,
    itemTags: game.itemTags || {},
    sharedGoldSufficient: true
  };
}

function applyNodeEffects(state, node) {
  const context = makeContext(state);
  const results = applyEffects(
    state.hero,
    node.effects || [],
    context,
    constantRng
  );

  for (const result of results) {
    assert.notEqual(result?.unsupported, true);
  }

  state.shared = context.shared;

  if (context.pendingSharedLoot) {
    state.hero.gold += Number(context.pendingSharedLoot.gold || 0);
    for (const item of context.pendingSharedLoot.items || []) {
      state.hero.items.push(item);
    }
  }
}

function applyRewardEffects(state, node) {
  const context = makeContext(state);
  const results = applyEffects(
    state.hero,
    node.rewards || [],
    context,
    constantRng
  );

  for (const result of results) {
    assert.notEqual(result?.unsupported, true);
  }

  state.shared = context.shared;
}

function resolveStep(state, current, next) {
  const node = books[state.characterId].references[String(current)];
  assert.ok(node, `${state.characterId} ${current}: referência ausente`);
  assert.notEqual(node.estado, "pendente");

  applyNodeEffects(state, node);

  const syncResult = processSyncPoint(
    syncData,
    {
      character: state.characterId,
      reference: current,
      shared: state.shared
    },
    {
      character: state.hero,
      partnerCharacter: state.partner,
      partnerActive: state.partnerActive
    }
  );

  state.shared = syncResult.shared;

  if (
    syncResult.target &&
    Number(syncResult.target) !== current
  ) {
    assert.equal(
      Number(syncResult.target),
      next,
      `${state.characterId} ${current}: sincronização esperava ${syncResult.target}, caminho usa ${next}`
    );
    state.visited.push(current);
    return;
  }

  if (node.partnerRemoved) {
    state.partnerActive = false;
  }

  const context = makeContext(state);
  const choice = availableChoices(node, context)
    .find(entry => Number(entry.target) === next);

  if (choice) {
    const results = applyEffects(
      state.hero,
      choice.effects || [],
      context,
      constantRng
    );

    for (const result of results) {
      assert.notEqual(result?.unsupported, true);
    }

    state.shared = context.shared;
    state.visited.push(current);
    return;
  }

  if (node.referenceInput) {
    const min = Number(node.referenceInput.min || 1);
    const max = Number(node.referenceInput.max || 500);

    if (next >= min && next <= max) {
      state.visited.push(current);
      return;
    }
  }

  if (Number(node.onVictory) === next) {
    applyRewardEffects(state, node);
    state.visited.push(current);
    return;
  }

  assert.ok(
    directTargets(node).includes(next),
    `${state.characterId} ${current}: transição para ${next} não existe ou não está disponível`
  );

  state.visited.push(current);
}

function executeCanonicalPath(characterId) {
  const path = canonicalPaths[characterId];
  const state = createPathState(characterId);

  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];

    resolveStep(state, current, next);

    assert.ok(
      state.hero.stats.energia > 0,
      `${characterId} morreu durante a rota na referência ${current}`
    );
  }

  const finalReference = path.at(-1);
  const finalNode =
    books[characterId].references[String(finalReference)];

  applyNodeEffects(state, finalNode);
  state.visited.push(finalReference);

  assert.equal(finalReference, 500);
  assert.equal(finalNode.ending, "success");
  assert.equal(state.visited.length, path.length);

  return state;
}

test("rota canônica de Colthar preserva estado até o final 500", () => {
  const state = executeCanonicalPath("colthar");

  assert.equal(state.visited[0], 1);
  assert.equal(state.visited.at(-1), 500);
  assert.ok(state.hero.flags.length >= 0);
});

test("rota canônica de Lothar preserva estado até o final 500", () => {
  const state = executeCanonicalPath("lothar");

  assert.equal(state.visited[0], 1);
  assert.equal(state.visited.at(-1), 500);
  assert.ok(state.hero.flags.length >= 0);
});
