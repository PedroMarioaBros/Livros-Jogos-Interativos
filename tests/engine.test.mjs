import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

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
import {
  castCombatSpell,
  combatSpellLimit
} from "../src/engine/magic.js";
import { processSyncPoint, resolveSyncTarget } from "../src/engine/sync.js";
import {
  applyEffects,
  availableChoices,
  countItem,
  resolveDynamicDuoComparison
} from "../src/engine/story.js";
import { createEncounter, playEncounterRound } from "../src/engine/encounter.js";
import { createSaveSnapshot, serializeSave, parseSave } from "../src/engine/save.js";
import {
  applyCombatSpell,
  applyCooperativeCombatSpell
} from "../src/engine/spell-combat.js";
import { createDuoSession, beginHandoff, completeHandoff, updateDuoPlayer } from "../src/engine/duo.js";

function sequence(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

const warriorBookData = JSON.parse(
  await fs.readFile(
    new URL(
      "../jogos/furia-de-principes/data/colthar.json",
      import.meta.url
    ),
    "utf8"
  )
);

const mageBookData = JSON.parse(
  await fs.readFile(
    new URL(
      "../jogos/furia-de-principes/data/lothar.json",
      import.meta.url
    ),
    "utf8"
  )
);

const syncBookData = JSON.parse(
  await fs.readFile(
    new URL(
      "../jogos/furia-de-principes/data/sincronizacao.json",
      import.meta.url
    ),
    "utf8"
  )
);

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

test("sincronização 217 de Lothar resolve STATUS 10 e 9", () => {
  const entry = syncBookData.entries.find(
    item => item.character === "lothar" && item.reference === 217
  );
  const ref217 = mageBookData.references["217"];

  assert.equal(entry.verified, true);
  assert.equal(entry.needsManualReview, undefined);
  assert.equal(resolveSyncTarget(entry, { status: 10, acao: 29 }), 37);
  assert.equal(resolveSyncTarget(entry, { status: 9, acao: 29 }), 493);

  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  assert.deepEqual(
    availableChoices(ref217, {
      character: mage,
      shared: { status: 10, acao: 29 },
      partnerActive: true
    }).map(choice => choice.target),
    [37]
  );
  assert.deepEqual(
    availableChoices(ref217, {
      character: mage,
      shared: { status: 9, acao: 29 },
      partnerActive: true
    }).map(choice => choice.target),
    [493]
  );
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


test("regra especial pode fazer um acerto atingir os dois príncipes", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const enemy = createOpponent({
    name: "Bruxa",
    habilidade: 20,
    energia: 6
  });
  const state = createCooperativeCombatState(
    [colthar, lothar],
    [enemy],
    {
      rng: sequence([0]),
      specialRule: "enemy_hit_damages_both"
    }
  );

  const beforeColthar = colthar.stats.energia;
  const beforeLothar = lothar.stats.energia;
  const result = cooperativeCombatStep(state, {
    rng: sequence([0.9, 0.9, 0, 0])
  });
  const event = result.events[0];

  assert.equal(event.result.outcome, "enemy-hit");
  assert.equal(colthar.stats.energia, beforeColthar - 2);
  assert.equal(lothar.stats.energia, beforeLothar - 2);
  assert.deepEqual(event.collateralDamage, [
    {
      heroIndex: 1,
      damage: 2,
      energyAfter: beforeLothar - 2
    }
  ]);
});

test("Feitiço de Combate aplica modificadores aos dois príncipes", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = {
    name: "Lothar",
    initialStats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    stats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    flags: []
  };
  const enemy = createOpponent({ name: "Troll", habilidade: 9, energia: 10 });
  const state = createCooperativeCombatState([colthar, lothar], [enemy], {
    rng: sequence([0])
  });

  const result = applyCooperativeCombatSpell(
    lothar,
    state,
    {
      id: "aura-de-invencibilidade",
      name: "Aura de Invencibilidade",
      cost: 3,
      effect: { type: "hero-and-ally-skill-delta", value: 1 }
    },
    {
      heroIndex: 1,
      rng: sequence([0])
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.equal(state.modifiersByHero[0].heroSkill, 1);
  assert.equal(state.modifiersByHero[1].heroSkill, 1);
  assert.equal(lothar.stats.magia, 9);
});

test("Sombra recebe o dano no lugar de Lothar em combate cooperativo", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = {
    name: "Lothar",
    initialStats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    stats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    flags: []
  };
  const enemies = [
    createOpponent({ name: "A", habilidade: 20, energia: 8 }),
    createOpponent({ name: "B", habilidade: 20, energia: 8 })
  ];
  const state = createCooperativeCombatState([colthar, lothar], enemies, {
    rng: sequence([0])
  });

  const spellResult = applyCooperativeCombatSpell(
    lothar,
    state,
    {
      id: "sombra",
      name: "Sombra",
      cost: 1,
      effect: { type: "combat-proxy", habilidade: 7, energia: 4 }
    },
    {
      heroIndex: 1,
      rng: sequence([0])
    }
  );

  const before = lothar.stats.energia;
  const round = cooperativeCombatStep(state, {
    rng: sequence([
      0.9, 0.9, 0, 0,
      0.9, 0.9, 0, 0
    ])
  });
  const lotharEvent = round.events.find(event => event.heroIndex === 1);

  assert.equal(spellResult.success, true);
  assert.equal(lotharEvent.usedProxy, true);
  assert.equal(lotharEvent.attackerName, "Sombra");
  assert.equal(state.proxiesByHero[1].stats.energia, 2);
  assert.equal(lothar.stats.energia, before);
});

test("feitiço pode encerrar combate cooperativo antes da primeira série", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = {
    name: "Lothar",
    initialStats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    stats: { habilidade: 7, energia: 14, sorte: 7, magia: 12 },
    flags: []
  };
  const enemies = [
    createOpponent({ name: "A", habilidade: 6, energia: 2 }),
    createOpponent({ name: "B", habilidade: 6, energia: 2 })
  ];
  const state = createCooperativeCombatState([colthar, lothar], enemies, {
    rng: sequence([0])
  });

  const result = applyCooperativeCombatSpell(
    lothar,
    state,
    {
      id: "zap",
      name: "Zap (Atacar)",
      cost: 3,
      effect: {
        type: "all-enemies-delta",
        habilidade: -1,
        energia: -2
      }
    },
    {
      heroIndex: 1,
      rng: sequence([0])
    }
  );

  assert.equal(result.encounterVictory, true);
  assert.equal(state.finished, true);
  assert.equal(state.winner, "heroes");
  assert.deepEqual(state.enemies.map(enemy => enemy.energia), [0, 0]);
});

test("motor narrativo aplica ouro, itens, atributos e dano aleatório", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.energia = 10;

  const results = applyEffects(
    hero,
    [
      { type: "change_gold", delta: -2 },
      { type: "add_item", item: "amuleto" },
      { type: "change_stat", stat: "energia", delta: 2, cap: "initial" },
      { type: "random_stat_damage", stat: "energia", dice: "1d6" }
    ],
    {},
    sequence([0])
  );

  assert.equal(hero.gold, 8);
  assert.equal(hero.items.includes("amuleto"), true);
  assert.equal(hero.stats.energia, 11);
  assert.equal(results[3].roll.total, 1);
});

test("motor narrativo filtra escolhas por inventário, ouro e estado do parceiro", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.items.push("chave");

  const node = {
    choices: [
      { label: "A", target: 1, conditions: [{ type: "has_item", item: "chave" }] },
      { label: "B", target: 2, conditions: [{ type: "gold_gte", value: 20 }] },
      { label: "C", target: 3, conditions: [{ type: "partner_active" }] }
    ]
  };

  const choices = availableChoices(node, {
    character: hero,
    shared: { status: 0, acao: 0 },
    partnerActive: true
  });

  assert.deepEqual(choices.map(choice => choice.target), [1, 3]);
});


test("controlador de encontro avança para o próximo inimigo", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.habilidade = 20;

  const encounter = createEncounter(47, {
    enemies: [
      { name: "Primeiro", habilidade: 1, energia: 2 },
      { name: "Segundo", habilidade: 1, energia: 2 }
    ]
  });

  const first = playEncounterRound(encounter, hero, {
    rng: sequence([0, 0, 0.9, 0.9])
  });

  assert.equal(first.victory, false);
  assert.equal(first.nextOpponent.name, "Segundo");

  const second = playEncounterRound(encounter, hero, {
    rng: sequence([0, 0, 0.9, 0.9])
  });

  assert.equal(second.finished, true);
  assert.equal(second.victory, true);
  assert.equal(encounter.rounds.length, 2);
});

test("controlador de encontro encerra quando o herói cai", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.energia = 2;
  hero.stats.habilidade = 1;

  const encounter = createEncounter(999, {
    enemies: [{ name: "Forte", habilidade: 20, energia: 10 }]
  });

  const result = playEncounterRound(encounter, hero, {
    rng: sequence([0.9, 0.9, 0, 0])
  });

  assert.equal(result.finished, true);
  assert.equal(result.defeat, true);
  assert.equal(hero.stats.energia, 0);
});


test("salvamento preserva ficha, referência, sincronização e histórico", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));

  const state = {
    config: { id: "furia-de-principes" },
    mode: "solo",
    character: "colthar",
    hero,
    shared: { status: 1, acao: 1 },
    ref: 34,
    partnerActive: false,
    completedEncounters: new Set([12, 20]),
    encounter: null,
    history: [{ from: 1, to: 34, label: "Teste" }],
    duo: null
  };

  const snapshot = createSaveSnapshot(state);
  assert.equal(snapshot.reference, 34);
  assert.deepEqual(snapshot.completedEncounters, [12, 20]);

  const restored = parseSave(serializeSave(state));
  assert.equal(restored.character, "colthar");
  assert.equal(restored.hero.gold, 10);
  assert.equal(restored.history[0].to, 34);
});

test("salvamento rejeita versão incompatível", () => {
  assert.throws(
    () => parseSave(JSON.stringify({ version: 999 })),
    /incompatível/
  );
});


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

test("Poder aumenta HABILIDADE apenas como modificador do encontro", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const originalSkill = mage.stats.habilidade;
  const encounter = createEncounter(1, {
    enemies: [{ name: "Inimigo", habilidade: 8, energia: 8 }]
  });

  const result = applyCombatSpell(
    mage,
    encounter,
    { id: "poder", name: "Poder", cost: 1, effect: { type: "hero-skill-delta", value: 1 } },
    { rng: sequence([0]) }
  );

  assert.equal(result.success, true);
  assert.equal(encounter.modifiers.heroSkill, 1);
  assert.equal(mage.stats.habilidade, originalSkill);
});

test("Sono pode vencer o encontro sem iniciar combate", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const encounter = createEncounter(1, {
    enemies: [{ name: "Inimigo", habilidade: 8, energia: 2 }]
  });

  const result = applyCombatSpell(
    mage,
    encounter,
    {
      id: "sono",
      name: "Sono",
      cost: 1,
      effect: {
        type: "sleep-check-per-enemy",
        failsIfAnyDieIs: 6
      }
    },
    { rng: sequence([0, 0, 0]) }
  );

  assert.equal(result.success, true);
  assert.equal(result.encounterVictory, true);
  assert.equal(encounter.enemies[0].asleep, true);
});

test("Sombra luta primeiro e preserva a ENERGIA de Lothar ao cair", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const originalEnergy = mage.stats.energia;
  const encounter = createEncounter(1, {
    enemies: [{ name: "Inimigo", habilidade: 20, energia: 20 }]
  });

  const spell = applyCombatSpell(
    mage,
    encounter,
    {
      id: "sombra",
      name: "Sombra",
      cost: 1,
      effect: { type: "combat-proxy", habilidade: 7, energia: 4 }
    },
    { rng: sequence([0]) }
  );

  assert.equal(spell.success, true);

  encounter.proxy.stats.energia = 2;
  const round = playEncounterRound(encounter, mage, {
    rng: sequence([0.9, 0.9, 0, 0])
  });

  assert.equal(round.round.usedProxy, true);
  assert.equal(round.round.proxyDefeated, true);
  assert.equal(mage.stats.energia, originalEnergy);
});

test("Estontear pode anular um golpe recebido", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.habilidade = 1;
  const enemy = createOpponent({ name: "Forte", habilidade: 20, energia: 10 });

  const result = combatRound(
    hero,
    enemy,
    sequence([0.9, 0.9, 0, 0, 0]),
    {
      incomingHitSave: {
        noDamageResults: [1, 2, 3],
        normalDamageResults: [4, 5, 6]
      }
    }
  );

  assert.equal(result.outcome, "enemy-hit");
  assert.equal(result.incomingSaveRoll, 1);
  assert.equal(result.damagePrevented, true);
  assert.equal(result.damage, 0);
});


test("sessão em dupla preserva estados independentes dos dois príncipes", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));

  const session = createDuoSession({
    colthar: { hero: colthar, reference: 31 },
    lothar: { hero: lothar, reference: 199 }
  });

  updateDuoPlayer(session, "colthar", {
    reference: 44,
    history: [{ from: 31, to: 44, label: "Sincronização" }]
  });

  assert.equal(session.players.colthar.reference, 44);
  assert.equal(session.players.lothar.reference, 199);
  assert.equal(session.players.lothar.history.length, 0);
});

test("passar o aparelho oculta a troca até o outro jogador confirmar", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));

  const session = createDuoSession({
    colthar: { hero: colthar, reference: 1 },
    lothar: { hero: lothar, reference: 1 }
  });

  const handoff = beginHandoff(session);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.targetCharacter, "lothar");
  assert.equal(session.activeCharacter, "colthar");
  assert.equal(session.handoffPending, true);

  const completed = completeHandoff(session);
  assert.equal(completed.ok, true);
  assert.equal(session.activeCharacter, "lothar");
  assert.equal(session.handoffPending, false);
});


test("salvamento pode preservar uma sessão em dupla completa", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const duo = createDuoSession({
    colthar: { hero: colthar, reference: 31 },
    lothar: { hero: lothar, reference: 199 }
  }, "lothar");

  const state = {
    config: { id: "furia-de-principes" },
    mode: "dupla",
    character: "lothar",
    hero: lothar,
    shared: { status: 19, acao: 23 },
    ref: 199,
    partnerActive: true,
    completedEncounters: new Set(),
    encounter: null,
    history: [],
    duo
  };

  const restored = parseSave(serializeSave(state));
  assert.equal(restored.duo.activeCharacter, "lothar");
  assert.equal(restored.duo.players.colthar.reference, 31);
  assert.equal(restored.shared.status, 19);
  assert.equal(restored.shared.acao, 23);
});


test("salvamento preserva combate cooperativo em andamento", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const duo = createDuoSession({
    colthar: { hero: colthar, reference: 43 },
    lothar: { hero: lothar, reference: 43 }
  });

  const cooperativeEncounter = createCooperativeCombatState(
    [duo.players.colthar.hero, duo.players.lothar.hero],
    [
      createOpponent({ name: "A", habilidade: 8, energia: 6 }),
      createOpponent({ name: "B", habilidade: 7, energia: 4 })
    ]
  );
  cooperativeEncounter.reference = 43;

  const state = {
    config: { id: "furia-de-principes" },
    mode: "dupla",
    character: "colthar",
    hero: duo.players.colthar.hero,
    shared: { status: 0, acao: 0 },
    ref: 43,
    partnerActive: true,
    completedEncounters: new Set(),
    encounter: null,
    history: [],
    duo,
    cooperativeEncounter
  };

  const restored = parseSave(serializeSave(state));
  assert.equal(restored.cooperativeEncounter.reference, 43);
  assert.equal(restored.cooperativeEncounter.enemies.length, 2);
  assert.equal(restored.cooperativeEncounter.heroes.length, 2);
});


test("efeitos narrativos novos restauram atributo e preservam item excluído", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.items.push("anel");
  mage.stats.magia = 1;

  const context = {};
  const result = applyEffects(
    mage,
    [
      { type: "remove_item_if_present", item: "cavalo" },
      { type: "clear_items_except", items: ["cajado"] },
      { type: "restore_stat_to_initial", stat: "magia" },
      { type: "add_shared_loot", gold: 10, items: ["joia"] }
    ],
    context
  );

  assert.deepEqual(mage.items, ["cajado"]);
  assert.equal(mage.stats.magia, mage.initialStats.magia);
  assert.equal(context.pendingSharedLoot.gold, 10);
  assert.deepEqual(context.pendingSharedLoot.items, ["joia"]);
  assert.equal(result[3].pending, true);
});

test("feitiço situacional falha automaticamente quando MAGIA é zero", async () => {
  const { castSituationalSpell } = await import("../src/engine/magic.js");
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.stats.magia = 0;

  const result = castSituationalSpell(
    mage,
    { cost: 2, successTarget: 100, failureTarget: 200 },
    sequence([0])
  );

  assert.equal(result.ok, true);
  assert.equal(result.success, false);
  assert.equal(result.automaticFailure, true);
  assert.equal(result.target, 200);
});


test("itens podem ser guardados como roubados e restaurados depois", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  applyEffects(mage, [{ type: "stash_and_clear_items" }]);

  assert.deepEqual(mage.items, []);
  assert.deepEqual(mage.stashedItems, ["cavalo", "cajado", "mochila"]);

  applyEffects(mage, [{ type: "restore_stashed_items" }]);
  assert.deepEqual(mage.items, ["cavalo", "cajado", "mochila"]);
  assert.deepEqual(mage.stashedItems, []);
});

test("encontro aplica modificador de HABILIDADE definido pela referência", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const encounter = createEncounter(197, {
    modifiers: { heroSkill: -3 },
    enemies: [{ name: "Wight", habilidade: 1, energia: 2 }]
  });

  assert.equal(encounter.modifiers.heroSkill, -3);
});

test("dano de combate fica disponível para recuperação posterior", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  hero.stats.habilidade = 1;
  const encounter = createEncounter(122, {
    enemies: [{ name: "Ogre", habilidade: 20, energia: 10 }]
  });

  playEncounterRound(encounter, hero, {
    rng: sequence([0.9, 0.9, 0, 0])
  });

  assert.equal(hero.lastCombatDamage, 2);
  hero.stats.energia = Math.max(1, hero.stats.energia);

  const before = hero.stats.energia;
  applyEffects(hero, [{
    type: "recover_fraction_last_combat_damage",
    stat: "energia",
    fraction: 0.5
  }]);
  assert.equal(hero.stats.energia, Math.min(hero.initialStats.energia, before + 1));
});


test("itens preservados podem excluir objetos mantidos com o personagem", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.items.push("anel");

  applyEffects(mage, [{
    type: "stash_items_except",
    items: ["cajado"]
  }]);

  assert.deepEqual(mage.items, ["cajado"]);
  assert.deepEqual(
    mage.stashedItems.sort(),
    ["anel", "cavalo", "mochila"].sort()
  );

  applyEffects(mage, [{ type: "restore_stashed_items" }]);
  assert.deepEqual(
    mage.items.sort(),
    ["anel", "cajado", "cavalo", "mochila"].sort()
  );
});


test("set_stat define atributo sem ultrapassar o valor inicial", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.stats.magia = 5;

  applyEffects(mage, [{
    type: "set_stat",
    stat: "magia",
    value: 0
  }]);

  assert.equal(mage.stats.magia, 0);

  applyEffects(mage, [{
    type: "set_stat",
    stat: "magia",
    value: 999
  }]);

  assert.equal(mage.stats.magia, mage.initialStats.magia);
});


test("vitória sobre o Djinn permite dois Feitiços de Combate", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.flags.push("dois_feiticos_de_combate");
  const encounter = createEncounter(362, {
    enemies: [{ name: "Inimigo", habilidade: 8, energia: 20 }]
  });
  const spell = {
    id: "poder",
    cost: 1,
    effect: { type: "hero-skill-delta", value: 1 }
  };

  assert.equal(combatSpellLimit(mage), 2);

  const first = castCombatSpell(mage, spell, encounter, {
    rng: sequence([0])
  });
  const second = castCombatSpell(mage, spell, encounter, {
    rng: sequence([0])
  });
  const third = castCombatSpell(mage, spell, encounter, {
    rng: sequence([0])
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
  assert.equal(third.reason, "combat-spell-limit-reached");
});

test("maldição do cálice impede recuperação de ENERGIA", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  mage.stats.energia -= 4;
  mage.flags.push("sem_recuperacao_energia");
  const before = mage.stats.energia;

  applyEffects(mage, [{
    type: "change_stat",
    stat: "energia",
    delta: 3
  }]);

  assert.equal(mage.stats.energia, before);
  assert.equal(consumeProvision(mage).reason, "energy-recovery-blocked");
});

test("efeito pode aumentar o valor inicial de SORTE", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const before = mage.initialStats.sorte;

  applyEffects(mage, [{
    type: "increase_initial_stat",
    stat: "sorte",
    delta: 1
  }]);

  assert.equal(mage.initialStats.sorte, before + 1);
});


test("condição de ouro conjunto soma recursos dos dois príncipes", () => {
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  colthar.gold = 7;
  lothar.gold = 13;

  assert.equal(
    availableChoices(
      {
        choices: [{
          target: 132,
          conditions: [{ type: "shared_gold_gte", value: 20 }]
        }]
      },
      {
        character: colthar,
        partnerCharacter: lothar,
        shared: {},
        partnerActive: true
      }
    ).length,
    1
  );

  lothar.gold = 12;

  assert.equal(
    availableChoices(
      {
        choices: [{
          target: 132,
          conditions: [{ type: "shared_gold_gte", value: 20 }]
        }]
      },
      {
        character: colthar,
        partnerCharacter: lothar,
        shared: {},
        partnerActive: true
      }
    ).length,
    0
  );
});


test("salvamento preserva tesouro compartilhado ainda não dividido", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));

  const state = {
    config: { id: "furia-de-principes" },
    mode: "solo",
    character: "colthar",
    hero,
    shared: { status: 1, acao: 1 },
    ref: 9,
    partnerActive: false,
    completedEncounters: new Set(),
    encounter: null,
    cooperativeEncounter: null,
    history: [],
    duo: null,
    pendingSharedLoot: {
      reference: 9,
      gold: 10,
      items: ["joia_vermelha"]
    }
  };

  const restored = parseSave(serializeSave(state));

  assert.equal(restored.pendingSharedLoot.reference, 9);
  assert.equal(restored.pendingSharedLoot.gold, 10);
  assert.deepEqual(
    restored.pendingSharedLoot.items,
    ["joia_vermelha"]
  );
});


test("shared_in aceita múltiplos valores de STATUS ou AÇÃO", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const node = {
    choices: [{
      target: 13,
      conditions: [{
        type: "shared_in",
        key: "acao",
        values: [1, 25]
      }]
    }]
  };

  assert.equal(
    availableChoices(node, {
      character: hero,
      shared: { acao: 25 },
      partnerActive: true
    }).length,
    1
  );

  assert.equal(
    availableChoices(node, {
      character: hero,
      shared: { acao: 24 },
      partnerActive: true
    }).length,
    0
  );
});

test("penalidade temporária de HABILIDADE some ao recuperar uma arma", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const initialSkill = hero.stats.habilidade;
  const itemTags = {
    weapons: ["espada", "cajado", "martelo_do_trovao"]
  };

  applyEffects(
    hero,
    [
      { type: "stash_and_clear_items" },
      {
        type: "change_stat",
        stat: "habilidade",
        delta: -2,
        temporaryUntil: "has_weapon"
      }
    ],
    { itemTags }
  );

  assert.equal(hero.stats.habilidade, initialSkill - 2);
  assert.equal(hero.temporaryEffects.length, 1);

  applyEffects(
    hero,
    [{ type: "restore_stashed_items" }],
    { itemTags }
  );

  assert.equal(hero.items.includes("espada"), true);
  assert.equal(hero.stats.habilidade, initialSkill);
  assert.equal(hero.temporaryEffects.length, 0);
});

test("recuperar item que não é arma mantém penalidade temporária", () => {
  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const initialSkill = hero.stats.habilidade;
  const itemTags = { weapons: ["espada"] };

  hero.items = [];
  applyEffects(
    hero,
    [{
      type: "change_stat",
      stat: "habilidade",
      delta: -2,
      temporaryUntil: "has_weapon"
    }],
    { itemTags }
  );

  applyEffects(
    hero,
    [{ type: "add_item", item: "anel" }],
    { itemTags }
  );

  assert.equal(hero.stats.habilidade, initialSkill - 2);
  assert.equal(hero.temporaryEffects.length, 1);
});

test("dados revisados de Colthar mantêm encontro 43 e sincronização 60", () => {
  assert.deepEqual(
    warriorBookData.references["43"].encounter.enemies[1],
    { name: "Mulher", habilidade: 8, energia: 4 }
  );

  const ref60 = warriorBookData.references["60"];
  assert.equal(
    ref60.effects.some(
      effect =>
        effect.type === "set_shared" &&
        effect.key === "status" &&
        effect.value === 4
    ),
    true
  );

  const route = ref60.choices.find(choice => choice.target === 13);
  assert.deepEqual(route.conditions[0].values, [1, 25]);
});


test("referência 31 de Colthar define STATUS 19 e resolve AÇÃO 1 ou 39", () => {
  const ref31 = warriorBookData.references["31"];

  assert.equal(
    ref31.effects.some(
      effect =>
        effect.type === "set_shared" &&
        effect.key === "status" &&
        effect.value === 19
    ),
    true
  );

  const hero = createCharacter(warriorData, sequence([0, 0, 0, 0]));

  assert.deepEqual(
    availableChoices(ref31, {
      character: hero,
      shared: { status: 19, acao: 1 },
      partnerActive: true
    }).map(choice => choice.target),
    [44]
  );

  assert.deepEqual(
    availableChoices(ref31, {
      character: hero,
      shared: { status: 19, acao: 39 },
      partnerActive: true
    }).map(choice => choice.target),
    [421]
  );
});

test("AÇÃO 1 na referência 41 converte STATUS para modo solo", () => {
  const choice = warriorBookData.references["41"].choices.find(
    item => item.target === 473
  );

  assert.deepEqual(choice.effects, [
    { type: "set_shared", key: "status", value: 1 }
  ]);
});


test("referência 70 usa o mesmo grupo completo nos dois volumes", () => {
  const colthar70 = warriorBookData.references["70"];
  const lothar70 = mageBookData.references["70"];

  const expectedEnemies = [
    { name: "Capanga Um", habilidade: 8, energia: 8 },
    { name: "Capanga Dois", habilidade: 8, energia: 6 },
    { name: "Capanga Três", habilidade: 7, energia: 6 },
    { name: "Coletor de Impostos", habilidade: 7, energia: 6 }
  ];

  assert.equal(colthar70.estado, "extraida");
  assert.equal(lothar70.estado, "extraida");
  assert.equal(colthar70.encounter.cooperative, true);
  assert.equal(lothar70.encounter.cooperative, true);
  assert.equal(colthar70.encounter.allowCombatMagic, true);
  assert.equal(lothar70.encounter.allowCombatMagic, true);
  assert.deepEqual(colthar70.encounter.enemies, expectedEnemies);
  assert.deepEqual(lothar70.encounter.enemies, expectedEnemies);
  assert.equal(colthar70.needsManualReview, undefined);
  assert.equal(lothar70.needsManualReview, undefined);
});


test("referência 47 de Colthar encaminha os dois resultados corretamente", () => {
  const ref47 = warriorBookData.references["47"];

  assert.equal(ref47.estado, "extraida");
  assert.equal(ref47.onVictory, 478);
  assert.equal(ref47.partnerOnVictory, 478);
  assert.equal(ref47.partnerOnDefeat, 6);
  assert.deepEqual(ref47.encounter.enemies, [
    { name: "Scuttlie Um", habilidade: 9, energia: 6 },
    { name: "Scuttlie Dois", habilidade: 8, energia: 6 }
  ]);
  assert.equal(ref47.needsMoreExtraction, undefined);
});


test("cenas de Lothar com suporte implementado não ficam marcadas como parciais", () => {
  const supportedReferences = [
    "120", "122", "146", "159", "182",
    "198", "285", "300", "381"
  ];

  for (const reference of supportedReferences) {
    const node = mageBookData.references[reference];
    assert.equal(node.estado, "extraida", `Referência ${reference}`);
    assert.equal(
      node.needsEngineSupport,
      undefined,
      `Referência ${reference} ainda marcada como needsEngineSupport`
    );
  }
});


test("Pedra de Poder é empilhável e pode ser contada", () => {
  const mage = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const context = {
    itemTags: { stackable: ["pedra_de_poder"] }
  };

  applyEffects(mage, [
    { type: "add_item", item: "pedra_de_poder" },
    { type: "add_item", item: "pedra_de_poder" }
  ], context);

  assert.equal(countItem(mage, "pedra_de_poder"), 2);

  applyEffects(mage, [
    { type: "add_item", item: "cajado" }
  ], context);
  assert.equal(countItem(mage, "cajado"), 1);
});

test("referência 421 resolve comparação das Pedras de Poder", () => {
  const lothar = createCharacter(mageData, sequence([0, 0, 0, 0, 0]));
  const colthar = createCharacter(warriorData, sequence([0, 0, 0, 0]));
  const comparison = mageBookData.references["421"].dynamicDuoComparison;

  lothar.items.push("pedra_de_poder", "pedra_de_poder");
  colthar.items.push("pedra_de_poder");

  assert.deepEqual(
    resolveDynamicDuoComparison(comparison, lothar, colthar),
    {
      target: 185,
      selfCount: 2,
      partnerCount: 1,
      outcome: "self-greater"
    }
  );

  colthar.items.push("pedra_de_poder");
  assert.equal(
    resolveDynamicDuoComparison(comparison, lothar, colthar).target,
    71
  );

  colthar.items.push("pedra_de_poder");
  assert.equal(
    resolveDynamicDuoComparison(comparison, lothar, colthar).target,
    44
  );
});
