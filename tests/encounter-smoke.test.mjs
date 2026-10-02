import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createCharacter } from "../src/engine/character.js";
import {
  createOpponent,
  createCooperativeCombatState,
  cooperativeCombatStep,
  resolveCooperativeCombat
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


function resolvedEncounterDefinition(node, hero, partner) {
  let definition = node.encounter;

  if (node.encounterDynamic?.type === "mirror_character_stats") {
    definition = {
      enemies: [{
        name: node.encounterDynamic.name || "Reflexo",
        habilidade: hero.stats.habilidade,
        energia: hero.stats.energia
      }]
    };
  }

  if (!definition) return null;

  const context = storyContext(hero, partner);

  return {
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
}

function resolveSoloEncounterToEnd(reference, definition, hero) {
  const state = createEncounter(Number(reference), definition);

  for (let round = 0; round < 500 && !state.finished; round += 1) {
    playEncounterRound(state, hero, { rng: constantRng });
  }

  return state;
}

test("todos os encontros completos chegam a vitória e derrota determinísticas", () => {
  const books = [
    ["colthar", warriorBookData],
    ["lothar", mageBookData]
  ];

  let victories = 0;
  let defeats = 0;

  for (const [characterId, book] of books) {
    for (const [reference, node] of Object.entries(book.references)) {
      if (node.estado === "parcial") continue;
      if (!node.encounter && !node.encounterDynamic) continue;

      {
        const heroes = createHeroes();
        const hero = heroes[characterId];
        const partner =
          heroes[characterId === "colthar" ? "lothar" : "colthar"];
        const definition = resolvedEncounterDefinition(
          node,
          hero,
          partner
        );

        assert.ok(
          definition?.enemies?.length,
          `${characterId} ${reference}: definição de vitória inválida`
        );

        heroes.colthar.stats.habilidade = 100;
        heroes.colthar.stats.energia = 100;
        heroes.lothar.stats.habilidade = 100;
        heroes.lothar.stats.energia = 100;

        if (definition.cooperative) {
          const result = resolveCooperativeCombat(
            [heroes.colthar, heroes.lothar],
            definition.enemies.map(createOpponent),
            {
              rng: constantRng,
              specialRule: definition.specialRule || null,
              maxSteps: 500
            }
          );

          assert.equal(
            result.finished,
            true,
            `${characterId} ${reference}: coop não terminou em cenário de vitória`
          );
          assert.equal(
            result.winner,
            "heroes",
            `${characterId} ${reference}: coop não terminou com vitória dos heróis`
          );
        } else {
          const state = resolveSoloEncounterToEnd(
            reference,
            definition,
            hero
          );

          assert.equal(
            state.finished,
            true,
            `${characterId} ${reference}: solo não terminou em cenário de vitória`
          );
          assert.equal(
            state.victory,
            true,
            `${characterId} ${reference}: solo não terminou com vitória`
          );
        }

        victories += 1;
      }

      {
        const heroes = createHeroes();
        const hero = heroes[characterId];
        const partner =
          heroes[characterId === "colthar" ? "lothar" : "colthar"];
        const definition = resolvedEncounterDefinition(
          node,
          hero,
          partner
        );

        assert.ok(
          definition?.enemies?.length,
          `${characterId} ${reference}: definição de derrota inválida`
        );

        heroes.colthar.stats.habilidade = -100;
        heroes.colthar.stats.energia = 2;
        heroes.lothar.stats.habilidade = -100;
        heroes.lothar.stats.energia = 2;

        if (definition.cooperative) {
          const result = resolveCooperativeCombat(
            [heroes.colthar, heroes.lothar],
            definition.enemies.map(createOpponent),
            {
              rng: constantRng,
              specialRule: definition.specialRule || null,
              maxSteps: 500
            }
          );

          assert.equal(
            result.finished,
            true,
            `${characterId} ${reference}: coop não terminou em cenário de derrota`
          );
          assert.equal(
            result.winner,
            "enemies",
            `${characterId} ${reference}: coop não terminou com derrota dos heróis`
          );
        } else {
          const state = resolveSoloEncounterToEnd(
            reference,
            definition,
            hero
          );

          assert.equal(
            state.finished,
            true,
            `${characterId} ${reference}: solo não terminou em cenário de derrota`
          );
          assert.equal(
            state.defeat,
            true,
            `${characterId} ${reference}: solo não terminou com derrota`
          );
        }

        defeats += 1;
      }
    }
  }

  assert.equal(victories, 104);
  assert.equal(defeats, 104);
});
