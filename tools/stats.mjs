import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function percent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function summarizeCharacter(data) {
  const nodes = Object.values(data.references || {});
  const states = {};

  for (const node of nodes) {
    states[node.estado] = (states[node.estado] || 0) + 1;
  }

  const completeReferences =
    Number(states.validada || 0) +
    Number(states.extraida || 0);
  const partialReferences = Number(states.parcial || 0);
  const pendingReferences = Number(states.pendente || 0);
  const manualReviewReferences = nodes.filter(node =>
    node.needsManualReview ||
    node.needsMoreExtraction ||
    node.encounterNeedsReview
  ).length;

  return {
    references: nodes.length,
    targetReferences: 500,
    structuredCoveragePercent: percent(nodes.length, 500),
    completeReferences,
    extractionCompletionPercent: percent(completeReferences, 500),
    completionWithinStructuredPercent: percent(
      completeReferences,
      nodes.length
    ),
    partialReferences,
    pendingReferences,
    manualReviewReferences,
    states,
    choices: nodes.reduce(
      (sum, node) => sum + (node.choices?.length || 0),
      0
    ),
    encounters: nodes.filter(
      node => node.encounter || node.encounterDynamic
    ).length,
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

const coltharSummary = summarizeCharacter(colthar);
const lotharSummary = summarizeCharacter(lothar);
const syncEntries = sync.entries || [];
const verifiedSyncEntries = syncEntries.filter(
  entry => entry.verified === true
).length;

const report = {
  generatedAt: new Date().toISOString(),
  colthar: coltharSummary,
  lothar: lotharSummary,
  synchronization: {
    mappedEntries: syncEntries.length,
    verifiedEntries: verifiedSyncEntries,
    entriesNeedingReview: syncEntries.filter(
      entry => entry.verified !== true || entry.needsManualReview
    ).length,
    verificationPercent: percent(
      verifiedSyncEntries,
      syncEntries.length
    )
  },
  combinedNarrativeExtraction: {
    targetReferences: 1000,
    structuredReferences:
      coltharSummary.references +
      lotharSummary.references,
    completeReferences:
      coltharSummary.completeReferences +
      lotharSummary.completeReferences,
    structuredCoveragePercent: percent(
      coltharSummary.references +
        lotharSummary.references,
      1000
    ),
    extractionCompletionPercent: percent(
      coltharSummary.completeReferences +
        lotharSummary.completeReferences,
      1000
    ),
    explicitIncompleteReferences:
      coltharSummary.partialReferences +
      coltharSummary.pendingReferences +
      lotharSummary.partialReferences +
      lotharSummary.pendingReferences
  }
};

console.log(JSON.stringify(report, null, 2));
