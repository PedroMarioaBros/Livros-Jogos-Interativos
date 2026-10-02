import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createCharacter } from "../src/engine/character.js";
import {
  applyEffects,
  availableChoices,
  conditionMet
} from "../src/engine/story.js";
import { processSyncPoint } from "../src/engine/sync.js";
import { endingRemovesDuoPlayer } from "../src/engine/duo.js";

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

const canonicalDuoRoute = [
  { character: "colthar", to: 199 },
  { character: "colthar", wait: true },
  { character: "lothar", to: 199 },
  { character: "lothar", to: 287 },
  { character: "lothar", to: 486 },
  { character: "colthar", to: 9 },
  { character: "colthar", to: 186 },
  { character: "colthar", to: 230 },
  { character: "colthar", to: 350 },
  { character: "colthar", to: 497 },
  { character: "lothar", to: 293 },
  { character: "lothar", to: 151 },
  { character: "lothar", ending: "death" },
  { character: "colthar", to: 100 },
  { character: "colthar", to: 19 },
  { character: "colthar", to: 133 },
  { character: "colthar", to: 36 },
  { character: "colthar", to: 135 },
  { character: "colthar", to: 367 },
  { character: "colthar", to: 2 },
  { character: "colthar", to: 256 },
  { character: "colthar", to: 97 },
  { character: "colthar", to: 258 },
  { character: "colthar", to: 398 },
  { character: "colthar", to: 476 },
  { character: "colthar", to: 208 },
  { character: "colthar", to: 382 },
  { character: "colthar", to: 101 },
  { character: "colthar", to: 432 },
  { character: "colthar", to: 137 },
  { character: "colthar", to: 296 },
  { character: "colthar", to: 217 },
  { character: "colthar", to: 96 },
  { character: "colthar", to: 4 },
  { character: "colthar", to: 52 },
  { character: "colthar", to: 141 },
  { character: "colthar", to: 331 },
  { character: "colthar", to: 412 },
  { character: "colthar", to: 327 },
  { character: "colthar", to: 271 },
  { character: "colthar", to: 430 },
  { character: "colthar", to: 123 },
  { character: "colthar", to: 282 },
  { character: "colthar", to: 338 },
  { character: "colthar", to: 37 },
  { character: "colthar", to: 197 },
  { character: "colthar", to: 127 },
  { character: "colthar", to: 374 },
  { character: "colthar", to: 460 },
  { character: "colthar", to: 34 },
  { character: "colthar", to: 238 },
  { character: "colthar", to: 456 },
  { character: "colthar", to: 78 },
  { character: "colthar", to: 344 },
  { character: "colthar", to: 86 },
  { character: "colthar", to: 51 },
  { character: "colthar", to: 305 },
  { character: "colthar", to: 41 },
  { character: "colthar", to: 473 },
  { character: "colthar", to: 409 },
  { character: "colthar", to: 375 },
  { character: "colthar", to: 415 },
  { character: "colthar", to: 227 },
  { character: "colthar", to: 111 },
  { character: "colthar", to: 319 },
  { character: "colthar", to: 99 },
  { character: "colthar", to: 181 },
  { character: "colthar", to: 31 },
  { character: "colthar", to: 44 },
  { character: "colthar", to: 433 },
  { character: "colthar", to: 465 },
  { character: "colthar", to: 454 },
  { character: "colthar", to: 500 },
  { character: "colthar", success: true }
];

function otherCharacter(character) {
  return character === "colthar" ? "lothar" : "colthar";
}

function createState() {
  return {
    refs: { colthar: 1, lothar: 1 },
    heroes: {
      colthar: createCharacter(colthar, constantRng),
      lothar: createCharacter(lothar, constantRng)
    },
    removed: { colthar: false, lothar: false },
    entryApplied: { colthar: false, lothar: false },
    shared: { status: 0, acao: 0 },
    history: []
  };
}

function contextFor(state, character) {
  const partner = otherCharacter(character);

  return {
    character: state.heroes[character],
    partnerCharacter: state.heroes[partner],
    partnerActive: !state.removed[partner],
    shared: state.shared,
    itemTags: game.itemTags || {},
    sharedGoldSufficient:
      state.heroes[character].gold +
      state.heroes[partner].gold >= 999
  };
}

function setReference(state, character, reference) {
  const next = Number(reference);

  if (state.refs[character] !== next) {
    state.refs[character] = next;
    state.entryApplied[character] = false;
  }
}

function resolveSharedLootToCurrentHero(state, character, loot) {
  const hero = state.heroes[character];

  hero.gold += Number(loot.gold || 0);

  for (const item of loot.items || []) {
    if (!hero.items.includes(item)) hero.items.push(item);
  }
}

function applyEntryEffects(state, character, node) {
  if (state.entryApplied[character]) return;

  const context = contextFor(state, character);
  const results = applyEffects(
    state.heroes[character],
    node.effects || [],
    context,
    constantRng
  );

  for (const result of results) {
    assert.notEqual(
      result?.unsupported,
      true,
      `${character} ${state.refs[character]}: efeito de entrada unsupported`
    );
  }

  state.shared = context.shared;

  if (context.pendingSharedLoot) {
    resolveSharedLootToCurrentHero(
      state,
      character,
      context.pendingSharedLoot
    );
  }

  state.entryApplied[character] = true;
}

function applyPartnerInstruction(state, character, node) {
  const instruction = node.partnerInstruction;
  if (!instruction) return;

  const partner = otherCharacter(character);
  if (state.removed[partner]) return;

  if (Number.isInteger(Number(instruction.sendToReference))) {
    setReference(
      state,
      partner,
      Number(instruction.sendToReference)
    );
    return;
  }

  for (const route of instruction.conditionalSend || []) {
    if (conditionMet(route.condition, contextFor(state, character))) {
      setReference(state, partner, Number(route.target));
      return;
    }
  }
}

function applyRemovalTransition(state, character, reference) {
  const result = processSyncPoint(
    syncData,
    {
      character,
      reference: Number(reference),
      shared: state.shared
    },
    {
      character: state.heroes[character],
      partnerCharacter: state.heroes[otherCharacter(character)],
      partnerActive: !state.removed[otherCharacter(character)]
    }
  );

  state.shared = result.shared;
}

function directTargetType(node, target) {
  const candidates = [
    ["test-success", node.test?.successTarget],
    ["test-failure", node.test?.failureTarget],
    ["victory", node.onVictory],
    ["defeat", node.onDefeat],
    ["failure", node.failureTarget],
    ["stat-success", node.rollAgainstStat?.successTarget],
    ["stat-failure", node.rollAgainstStat?.failureTarget],
    ["dynamic-true", node.dynamicCondition?.trueTarget],
    ["dynamic-false", node.dynamicCondition?.falseTarget],
    ["special-roll", node.encounterSpecial?.roundRoll?.target],
    ["special-victory", node.encounterSpecial?.onVictory],
    ["player-effect", node.playerEffectChoice?.continueTarget],
    ["merchant", node.merchant?.continueTarget]
  ];

  for (const route of node.roll?.routes || []) {
    candidates.push(["roll", route.target]);
  }
  for (const route of node.partnerRollRoutes || []) {
    candidates.push(["partner-roll", route.target]);
  }
  for (const option of node.spellOptions || []) {
    candidates.push(["spell", option.successTarget]);
  }
  for (const choice of node.failureChoices || []) {
    candidates.push(["failure-choice", choice.target]);
  }
  for (const choice of node.postVictoryChoices || []) {
    candidates.push(["post-victory", choice.target]);
  }

  return candidates.find(
    ([, value]) => Number(value) === Number(target)
  )?.[0] || null;
}

function applyVictoryRewards(state, character, node) {
  const context = contextFor(state, character);
  const results = applyEffects(
    state.heroes[character],
    node.rewards || [],
    context,
    constantRng
  );

  for (const result of results) {
    assert.notEqual(result?.unsupported, true);
  }

  state.shared = context.shared;
}

function processAction(state, action) {
  const character = action.character;
  const partner = otherCharacter(character);
  const reference = state.refs[character];
  const node = books[character].references[String(reference)];

  assert.ok(
    node,
    `${character} ${reference}: referência ausente`
  );
  assert.equal(
    state.removed[character],
    false,
    `${character} ${reference}: personagem já removido`
  );

  applyEntryEffects(state, character, node);

  const syncResult = processSyncPoint(
    syncData,
    {
      character,
      reference,
      shared: state.shared
    },
    {
      character: state.heroes[character],
      partnerCharacter: state.heroes[partner],
      partnerActive: !state.removed[partner]
    }
  );

  state.shared = syncResult.shared;

  if (
    syncResult.target &&
    Number(syncResult.target) !== reference
  ) {
    assert.equal(
      Number(syncResult.target),
      Number(action.to),
      `${character} ${reference}: sincronização leva a ${syncResult.target}, não ${action.to}`
    );
    setReference(state, character, syncResult.target);
    state.history.push(
      `${character} ${reference} sync→${syncResult.target}`
    );
    return;
  }

  if (action.wait) {
    assert.ok(
      syncResult.entry && !syncResult.target,
      `${character} ${reference}: espera de sincronização não ocorreu`
    );
    state.history.push(
      `${character} ${reference} aguardou ${syncResult.waitingFor}`
    );
    return;
  }

  if (node.partnerRemoved && !state.removed[partner]) {
    state.removed[partner] = true;
  }

  applyPartnerInstruction(state, character, node);

  if (action.ending) {
    assert.equal(node.ending, action.ending);

    if (endingRemovesDuoPlayer(node.ending)) {
      state.removed[character] = true;

      if (node.afterDeathReference) {
        applyRemovalTransition(
          state,
          character,
          node.afterDeathReference
        );
      }
    }

    state.history.push(
      `${character} ${reference} ending ${node.ending}`
    );
    return;
  }

  if (action.success) {
    assert.equal(node.ending, "success");
    state.history.push(
      `${character} ${reference} SUCCESS`
    );
    return;
  }

  const available = availableChoices(
    node,
    contextFor(state, character)
  );
  const choice = available.find(
    entry => Number(entry.target) === Number(action.to)
  );

  if (choice) {
    const choiceContext = contextFor(state, character);
    const results = applyEffects(
      state.heroes[character],
      choice.effects || [],
      choiceContext,
      constantRng
    );

    for (const result of results) {
      assert.notEqual(result?.unsupported, true);
    }

    state.shared = choiceContext.shared;
    setReference(state, character, action.to);

    if (
      Number.isInteger(Number(choice.partnerTarget)) &&
      !state.removed[partner]
    ) {
      setReference(
        state,
        partner,
        Number(choice.partnerTarget)
      );
    }

    state.history.push(
      `${character} ${reference} choice→${action.to}`
    );
    return;
  }

  if (node.referenceInput) {
    const min = Number(node.referenceInput.min || 1);
    const max = Number(node.referenceInput.max || 500);

    if (
      Number(action.to) >= min &&
      Number(action.to) <= max
    ) {
      setReference(state, character, action.to);
      state.history.push(
        `${character} ${reference} answer→${action.to}`
      );
      return;
    }
  }

  const directType = directTargetType(node, action.to);
  assert.ok(
    directType,
    `${character} ${reference}: transição para ${action.to} não existe ou não está disponível`
  );

  if (directType === "victory") {
    applyVictoryRewards(state, character, node);
  }

  setReference(state, character, action.to);
  state.history.push(
    `${character} ${reference} ${directType}→${action.to}`
  );
}

test("rota conjunta coerente leva Colthar do início ao sucesso 500", () => {
  const state = createState();

  for (const action of canonicalDuoRoute) {
    processAction(state, action);

    if (!state.removed.colthar) {
      assert.ok(
        state.heroes.colthar.stats.energia > 0,
        "Colthar morreu durante a rota canônica"
      );
    }

    if (!state.removed.lothar) {
      assert.ok(
        state.heroes.lothar.stats.energia > 0,
        "Lothar morreu antes do final previsto na referência 151"
      );
    }
  }

  assert.equal(state.refs.colthar, 500);
  assert.equal(state.removed.colthar, false);
  assert.equal(state.removed.lothar, true);
  assert.equal(state.shared.acao, 1);
  assert.equal(state.shared.status, 19);
  assert.equal(
    state.heroes.colthar.items.includes("gema_sagrada_azul"),
    true
  );
  assert.ok(state.history.length >= 70);
});
