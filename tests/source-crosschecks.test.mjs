import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const colthar = JSON.parse(
  fs.readFileSync(
    new URL("../jogos/furia-de-principes/data/colthar.json", import.meta.url),
    "utf8"
  )
);
const lothar = JSON.parse(
  fs.readFileSync(
    new URL("../jogos/furia-de-principes/data/lothar.json", import.meta.url),
    "utf8"
  )
);

function stats(node) {
  return node.encounter.enemies.map(enemy => [
    enemy.habilidade,
    enemy.energia
  ]);
}

test("Colthar 403 preserva os Orcs confirmados pelas variantes 455/486", () => {
  const ref403 = colthar.references["403"];
  const lothar455 = lothar.references["455"];
  const joint486 = colthar.references["486"];

  assert.equal(ref403.estado, "extraida");
  assert.deepEqual(stats(ref403), [[8, 6], [7, 4], [6, 4]]);
  assert.deepEqual(stats(ref403), stats(lothar455));
  assert.deepEqual(stats(ref403), stats(joint486));
  assert.equal(ref403.onVictory, 131);
});

test("Lothar 347 preserva o confronto confirmado por Colthar 142", () => {
  const ref347 = lothar.references["347"];
  const colthar142 = colthar.references["142"];

  assert.equal(ref347.estado, "extraida");
  assert.deepEqual(stats(ref347), [[8, 4], [7, 4], [6, 4]]);
  assert.deepEqual(stats(ref347), stats(colthar142));
  assert.equal(ref347.encounterSpecial.roundRoll.dice, "1d6");
  assert.equal(ref347.encounterSpecial.roundRoll.trigger, 6);
  assert.equal(ref347.encounterSpecial.roundRoll.target, 466);
  assert.equal(ref347.encounterSpecial.onVictory, 402);
});
