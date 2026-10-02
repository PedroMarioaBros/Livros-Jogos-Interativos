import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createCharacter } from "../src/engine/character.js";
import {
  createOpponent,
  createCooperativeCombatState,
  cooperativeCombatStep
} from "../src/engine/combat.js";
import {
  createEncounter,
  playEncounterRound
} from "../src/engine/encounter.js";
import {
  resolveConditionalEncounterModifiers,
  resolveConditionalEncounterEnemies
} from "../src/engine/story.js";

function constantRng() {
  return 0.25;
}

const [warriorBookData, mageBookData] = await Promise.all([
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
  ).then(JSON.parse)
]);

const warriorData = {
  character: "colthar",
  displayName: "Colthar",
  class: "guerreiro",
  initialStats: {
    habilidade: "1d6+6",
    energia: "2d6+12",
    sorte: "1d6+6"
  },
  startingResources: {
    provisions: 10,
    gold: 10,
    items: ["cavalo", "espada", "mochila"]
  }
};

const mageData = {
  character: "lothar",
  displayName: "Lothar",
  class: "feiticeiro",
  initialStats: {
    habilidade: "1d6+4",
    energia: "2d6+12",
    sorte: "1d6+6",
    magia: "2d6+12"
  },
  startingResources: {
    provisions: 10,
    gold: 10,
    items: ["cavalo", "cajado", "mochila"]
  }
};

function createHeroes() {
  return {
    colthar: createCharacter(warriorData, constantRng),
    lothar: createCharacter(mageData, constantRng)
  };
}

function storyContext(character, partner) {
  return {
    character,
    partnerCharacter: partner,
    partnerActive: true,
    shared: { status: 0, acao: 0 },
    itemTags: {}
  };
}

test("todos os encontros completos executam ao menos uma rodada", () => {
  const books = [
    ["colthar", warriorBookData],
    ["lothar", mageBookData]
  ];

  let completeStructured = 0;
  let cooperative = 0;
  let dynamic = 0;

  for (const [characterId, book] of books) {
    for (const [reference, node] of Object.entries(book.references)) {
      if (node.estado === "parcial") continue;

      const heroes = createHeroes();
      const hero = heroes[characterId];
      const partner =
        heroes[characterId === "colthar" ? "lothar" : "colthar"];
      const context = storyContext(hero, partner);

      let definition = node.encounter;

      if (node.encounterDynamic?.type === "mirror_character_stats") {
        dynamic += 1;
        definition = {
          enemies: [{
            name: node.encounterDynamic.name || "Reflexo",
            habilidade: hero.stats.habilidade,
            energia: hero.stats.energia
          }]
        };
      }

      if (!definition) continue;

      completeStructured += 1;

      const resolvedDefinition = {
        ...definition,
        enemies: resolveConditionalEncounterEnemies(
          definition,
          context
        ),
        modifiers: resolveConditionalEncounterModifiers(
          definition,
          context
        )
      };

      assert.ok(
        resolvedDefinition.enemies.length > 0,
        `${characterId} ${reference}: encontro ficou sem inimigos`
      );

      if (definition.cooperative) {
        cooperative += 1;
        const state = createCooperativeCombatState(
          [heroes.colthar, heroes.lothar],
          resolvedDefinition.enemies.map(createOpponent),
          {
            rng: constantRng,
            specialRule: definition.specialRule || null
          }
        );

        const result = cooperativeCombatStep(
          state,
          { rng: constantRng }
        );

        assert.ok(
          Array.isArray(result.events),
          `${characterId} ${reference}: combate cooperativo sem eventos`
        );
        assert.ok(
          state.step >= 1,
          `${characterId} ${reference}: rodada cooperativa não avançou`
        );
      } else {
        const state = createEncounter(
          Number(reference),
          resolvedDefinition
        );
        const result = playEncounterRound(
          state,
          hero,
          { rng: constantRng }
        );

        assert.ok(
          result.round,
          `${characterId} ${reference}: combate individual não produziu rodada`
        );
        assert.equal(
          state.rounds.length,
          1,
          `${characterId} ${reference}: rodada individual não foi registrada`
        );
      }
    }
  }

  assert.equal(completeStructured, 104);
  assert.equal(cooperative, 29);
  assert.equal(dynamic, 1);
});
