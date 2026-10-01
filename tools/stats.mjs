import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function summarizeCharacter(data) {
  const nodes = Object.values(data.references || {});
  const states = {};

  for (const node of nodes) {
    states[node.estado] = (states[node.estado] || 0) + 1;
  }

  return {
    references: nodes.length,
    percentOf500: Number(((nodes.length / 500) * 100).toFixed(1)),
    states,
    choices: nodes.reduce(
      (sum, node) => sum + (node.choices?.length || 0),
      0
    ),
    encounters: nodes.filter(node => node.encounter).length,
    endings: nodes.filter(node => node.ending).length,
    luckTests: nodes.filter(node => node.test?.type === "luck").length,
    situationalSpellScenes: nodes.filter(
      node => node.spellOptions?.length
    ).length,
    syncEffects: nodes.filter(node =>
      (node.effects || []).some(effect =>
        effect.type === "set_shared"
      )
    ).length
  };
}

const colthar = await readJSON(
  "jogos/furia-de-principes/data/colthar.json"
);
const lothar = await readJSON(
  "jogos/furia-de-principes/data/lothar.json"
);
const sync = await readJSON(
  "jogos/furia-de-principes/data/sincronizacao.json"
);

const report = {
  generatedAt: new Date().toISOString(),
  colthar: summarizeCharacter(colthar),
  lothar: summarizeCharacter(lothar),
  syncEntries: sync.entries?.length || 0,
  totalNarrativeReferences:
    Object.keys(colthar.references || {}).length +
    Object.keys(lothar.references || {}).length
};

console.log(JSON.stringify(report, null, 2));
