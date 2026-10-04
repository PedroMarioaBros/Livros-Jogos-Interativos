import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCharacter,
  consumeProvision
} from "../src/engine/character.js";
import { testLuck } from "../src/engine/luck.js";

const coltharData = JSON.parse(
  fs.readFileSync(
    new URL("../jogos/furia-de-principes/data/colthar.json", import.meta.url),
    "utf8"
  )
);

test("personagem preserva quantidade inicial de provisões", () => {
  const hero = createCharacter(coltharData, () => 0);

  assert.equal(hero.provisions, 10);
  assert.equal(hero.initialProvisions, 10);
});

test("provisão não pode ser consumida durante combate", () => {
  const hero = createCharacter(coltharData, () => 0);
  hero.stats.energia -= 4;

  const energyBefore = hero.stats.energia;
  const provisionsBefore = hero.provisions;

  const result = consumeProvision(hero, { inCombat: true });

  assert.deepEqual(result, { ok: false, reason: "blocked" });
  assert.equal(hero.stats.energia, energyBefore);
  assert.equal(hero.provisions, provisionsBefore);
});

test("provisão consome uma unidade e recupera no máximo 2 ENERGIA", () => {
  const hero = createCharacter(coltharData, () => 0);
  hero.stats.energia -= 3;

  const result = consumeProvision(hero);

  assert.equal(result.ok, true);
  assert.equal(result.restored, 2);
  assert.equal(result.provisions, 9);
  assert.equal(hero.provisions, 9);
  assert.equal(
    hero.stats.energia,
    hero.initialStats.energia - 1
  );
});

test("Teste de Sorte informa valores antes/depois e sempre reduz SORTE em 1", () => {
  const hero = createCharacter(coltharData, () => 0);
  hero.stats.sorte = 5;

  const result = testLuck(hero, () => 0.5);

  assert.equal(result.luckBefore, 5);
  assert.equal(result.total, 8);
  assert.deepEqual(result.rolls, [4, 4]);
  assert.equal(result.success, false);
  assert.equal(result.luckAfter, 4);
  assert.equal(hero.stats.sorte, 4);
});

test("interface não expõe Teste de Sorte geral e possui resultado contextual persistente", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8"
  );
  const app = fs.readFileSync(
    new URL("../src/app.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(html, /id=["']test-luck["']/);
  assert.match(html, /id=["']mechanics-result["']/);
  assert.match(app, /node\.test\?\.type === "luck"/);
  assert.match(app, /preserveMechanicsResult: true/);
  assert.match(app, /consumeProvision\(state\.hero, context\)/);
});

test("Colthar 117 permanece extraída e marcada para revisão manual sem rebalanceamento", () => {
  const ref117 = coltharData.references["117"];

  assert.equal(ref117.estado, "extraida");
  assert.equal(ref117.needsManualReview, true);
  assert.deepEqual(
    ref117.encounter.enemies.map(enemy => ({
      name: enemy.name,
      habilidade: enemy.habilidade,
      energia: enemy.energia
    })),
    [
      { name: "Gárgula Um", habilidade: 9, energia: 8 },
      { name: "Gárgula Dois", habilidade: 8, energia: 8 }
    ]
  );
  assert.equal(ref117.onVictory, 429);
});

test("regra especial de combate preserva cálculo após navegar", () => {
  const app = fs.readFileSync(
    new URL("../src/app.js", import.meta.url),
    "utf8"
  );

  assert.match(app, /REGRA ESPECIAL DE COMBATE/);
  assert.match(
    app,
    /Regra: a consequência especial é ativada quando o total é/
  );
  assert.match(
    app,
    /"Regra especial do combate",[\s\S]*preserveMechanicsResult: true/
  );
});

test("feitiços com dados exibem regra de conjuração e rolagens secundárias", () => {
  const app = fs.readFileSync(
    new URL("../src/app.js", import.meta.url),
    "utf8"
  );

  assert.match(app, /FEITIÇO DE COMBATE/);
  assert.match(app, /Regra de conjuração: 1–5 = sucesso; 6 = falha/);
  assert.match(app, /Dano da Rajada:/);
  assert.match(app, /Regra de Sono:/);
  assert.match(app, /Estontear: 1d6 =/);
  assert.match(app, /FEITIÇO NARRATIVO/);
});
