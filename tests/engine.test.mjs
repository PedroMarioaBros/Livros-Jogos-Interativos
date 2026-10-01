import test from "node:test";
import assert from "node:assert/strict";

import { rollExpression } from "../src/engine/dice.js";
import { createCharacter, consumeProvision } from "../src/engine/character.js";
import { testLuck } from "../src/engine/luck.js";
import { createOpponent, combatRound } from "../src/engine/combat.js";
import { castCombatSpell } from "../src/engine/magic.js";

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
