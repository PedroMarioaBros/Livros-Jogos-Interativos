import test from "node:test";
import assert from "node:assert/strict";

import { rollExpression } from "../src/engine/dice.js";
import { createCharacter, consumeProvision } from "../src/engine/character.js";
import { testLuck } from "../src/engine/luck.js";
import {
  createOpponent,
  combatRound,
  resolveSequentialCombat,
  createCooperativeCombatState,
  cooperativeCombatStep
} from "../src/engine/combat.js";
import { castCombatSpell } from "../src/engine/magic.js";
import { processSyncPoint, resolveSyncTarget } from "../src/engine/sync.js";

function sequence(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

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

test("interpreta e rola expressões de dados", () => {
  const result = rollExpression("2d6+12", sequence([0, 0.5]));
  assert.deepEqual(result.rolls, [1, 4]);
  assert.equal(result.total, 17);
});

test("cria Colthar com atributos e recursos iniciais", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  assert.equal(hero.stats.habilidade, 7);
  assert.equal(hero.stats.energia, 14);
  assert.equal(hero.stats.sorte, 7);
  assert.equal(hero.provisions, 10);
  assert.equal(hero.gold, 10);
  assert.deepEqual(hero.items, ["cavalo", "espada", "mochila"]);
});

test("provisão recupera até dois pontos sem ultrapassar o máximo", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.energia = 13;

  const result = consumeProvision(hero);
  assert.equal(result.ok, true);
  assert.equal(result.restored, 1);
  assert.equal(hero.stats.energia, 14);
  assert.equal(hero.provisions, 9);
});

test("provisão é bloqueada durante combate", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.energia = 10;

  const result = consumeProvision(hero, { inCombat: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "blocked");
  assert.equal(hero.provisions, 10);
});

test("Teste de Sorte usa 2d6 e reduz SORTE após a tentativa", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const result = testLuck(hero, sequence([0, 0]));

  assert.equal(result.success, true);
  assert.equal(result.total, 2);
  assert.equal(hero.stats.sorte, 6);
});

test("rodada de combate aplica dois pontos de dano ao perdedor", () => {
  const hero = createCharacter(warriorData, sequence([0.5, 0.5, 0.5, 0.5]));
  const enemy = createOpponent({ name: "Teste", habilidade: 5, energia: 6 });

  const result = combatRound(
    hero,
    enemy,
    sequence([0, 0, 0.5, 0.5])
  );

  assert.equal(result.outcome, "hero-hit");
  assert.equal(enemy.energia, 4);
});

test("feitiço de combate gasta MAGIA mesmo quando falha", () => {
  const mage = {
    initialStats: { habilidade: 7, energia: 18, sorte: 8, magia: 18 },
    stats: { habilidade: 7, energia: 18, sorte: 8, magia: 18 }
  };
  const encounter = { combatSpellAttempted: false };
  const spell = { id: "poder", cost: 1, effect: { type: "hero-skill-delta", value: 1 } };

  const result = castCombatSpell(mage, spell, encounter, {
    rng: sequence([0.999])
  });

  assert.equal(result.ok, true);
  assert.equal(result.success, false);
  assert.equal(mage.stats.magia, 17);
  assert.equal(encounter.combatSpellAttempted, true);
});


test("sincronização de Colthar 31 define STATUS 19 e reage à AÇÃO 39", () => {
  const syncData = {
    entries: [{
      character: "colthar",
      reference: 31,
      effects: [{ type: "set_shared", key: "status", value: 19 }],
      waitFor: "acao",
      routes: [
        { acao: [1], target: 44 },
        { acao: [39], target: 421 }
      ]
    }]
  };

  const result = processSyncPoint(syncData, {
    character: "colthar",
    reference: 31,
    shared: { status: 0, acao: 39 }
  });

  assert.equal(result.shared.status, 19);
  assert.equal(result.target, 421);
  assert.equal(result.waitingFor, "acao");
});

test("sincronização de Lothar escolhe rota pelo STATUS", () => {
  const entry = {
    routes: [
      { status: [1, 2], target: 242 },
      { status: [3], target: 287 }
    ]
  };

  assert.equal(resolveSyncTarget(entry, { status: 3, acao: 23 }), 287);
});

test("modo solo pode ignorar mutações cooperativas", () => {
  const syncData = {
    entries: [{
      character: "colthar",
      reference: 31,
      effects: [{ type: "set_shared", key: "status", value: 19 }],
      routes: [{ acao: [1], target: 44 }]
    }]
  };

  const result = processSyncPoint(
    syncData,
    {
      character: "colthar",
      reference: 31,
      shared: { status: 1, acao: 1 }
    },
    { ignoreMutations: true }
  );

  assert.deepEqual(result.shared, { status: 1, acao: 1 });
  assert.equal(result.target, 44);
});


test("combate solo contra vários inimigos é resolvido em sequência", () => {
  const hero = createCharacter(warriorData, sequence([0.5, 0.5, 0.5, 0.5]));
  hero.stats.habilidade = 20;

  const enemies = [
    createOpponent({ name: "Um", habilidade: 1, energia: 2 }),
    createOpponent({ name: "Dois", habilidade: 1, energia: 2 })
  ];

  const result = resolveSequentialCombat(hero, enemies, {
    rng: sequence([0, 0, 0.9, 0.9]),
    maxRounds: 5
  });

  assert.equal(result.winner, "hero");
  assert.equal(result.encounters.length, 2);
  assert.equal(enemies[0].energia, 0);
  assert.equal(enemies[1].energia, 0);
});

test("dois heróis enfrentam oponentes diferentes quando há vários inimigos", () => {
  const heroA = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const heroB = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  heroA.stats.habilidade = 20;
  heroB.stats.habilidade = 20;

  const enemies = [
    createOpponent({ name: "A", habilidade: 1, energia: 4 }),
    createOpponent({ name: "B", habilidade: 1, energia: 4 })
  ];

  const state = createCooperativeCombatState([heroA, heroB], enemies, {
    rng: sequence([0])
  });

  const result = cooperativeCombatStep(state, {
    rng: sequence([0, 0, 0.9, 0.9, 0, 0, 0.9, 0.9])
  });

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].enemyIndex, 0);
  assert.equal(result.events[1].enemyIndex, 1);
  assert.equal(enemies[0].energia, 2);
  assert.equal(enemies[1].energia, 2);
});

test("quando sobra um único inimigo, os heróis alternam as séries de ataque", () => {
  const heroA = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const heroB = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  heroA.stats.habilidade = 20;
  heroB.stats.habilidade = 20;

  const enemy = createOpponent({ name: "Chefe", habilidade: 1, energia: 8 });
  const state = createCooperativeCombatState([heroA, heroB], [enemy], {
    rng: sequence([0])
  });

  const first = cooperativeCombatStep(state, {
    rng: sequence([0, 0, 0.9, 0.9])
  });
  const firstHero = first.events[0].heroIndex;

  const second = cooperativeCombatStep(state, {
    rng: sequence([0, 0, 0.9, 0.9])
  });
  const secondHero = second.events[0].heroIndex;

  assert.notEqual(firstHero, secondHero);
  assert.equal(first.events[0].mode, "alternate");
  assert.equal(second.events[0].mode, "alternate");
});
