import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function addTarget(set, value) {
  if (Number.isInteger(value)) set.add(value);
}

function nodeTargets(node) {
  const targets = new Set();

  for (const choice of node.choices || []) addTarget(targets, choice.target);
  for (const choice of node.failureChoices || []) addTarget(targets, choice.target);
  for (const choice of node.postVictoryChoices || []) addTarget(targets, choice.target);
  for (const route of node.roll?.routes || []) addTarget(targets, route.target);
  for (const route of node.partnerRollRoutes || []) addTarget(targets, route.target);
  for (const route of node.partnerOutcomeRoutes || []) addTarget(targets, route.target);
  for (const route of node.partnerInstruction?.conditionalSend || []) addTarget(targets, route.target);
  for (const spell of node.spellOptions || []) addTarget(targets, spell.successTarget);

  addTarget(targets, node.test?.successTarget);
  addTarget(targets, node.test?.failureTarget);
  addTarget(targets, node.onVictory);
  addTarget(targets, node.onDefeat);
  addTarget(targets, node.failureTarget);
  addTarget(targets, node.partnerOnFailure);
  addTarget(targets, node.partnerOnDefeat);
  addTarget(targets, node.partnerOnVictory);
  addTarget(targets, node.partnerInstruction?.sendToReference);
  addTarget(targets, node.rollAgainstStat?.successTarget);
  addTarget(targets, node.rollAgainstStat?.failureTarget);
  addTarget(targets, node.dynamicCondition?.trueTarget);
  addTarget(targets, node.dynamicCondition?.falseTarget);
  addTarget(targets, node.dynamicChoice?.failureTarget);
  addTarget(targets, node.encounterSpecial?.roundRoll?.target);
  addTarget(targets, node.playerEffectChoice?.continueTarget);

  if (node.dynamicDuoComparison) {
    addTarget(targets, node.dynamicDuoComparison.partnerGreaterTarget);
    addTarget(targets, node.dynamicDuoComparison.selfGreaterTarget);
    addTarget(targets, node.dynamicDuoComparison.equalTarget);
  }

  if (node.merchant) addTarget(targets, node.merchant.continueTarget);

  return [...targets];
}

function analyzeCharacter(data, options = {}) {
  const refs = data.references || {};
  const ids = new Set(Object.keys(refs).map(Number));
  const edges = new Map();
  const invalidTargets = [];
  const targetsToUnextractedReferences = [];

  for (const [idText, node] of Object.entries(refs)) {
    const id = Number(idText);
    const targets = nodeTargets(node);
    edges.set(id, targets);

    for (const target of targets) {
      if (target < 1 || target > 500) {
        invalidTargets.push({ from: id, target });
      } else if (!ids.has(target)) {
        targetsToUnextractedReferences.push({ from: id, target });
      }
    }
  }

  const reachable = new Set();
  const queue = [1];

  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id) || !ids.has(id)) continue;
    reachable.add(id);

    for (const target of edges.get(id) || []) {
      if (!reachable.has(target) && ids.has(target)) queue.push(target);
    }
  }

  const unreachableExtracted = [...ids]
    .filter(id => !reachable.has(id))
    .sort((a, b) => a - b);

  const deadEnds = [...ids]
    .filter(id => {
      const node = refs[String(id)];
      const targets = edges.get(id) || [];
      const waiting = Boolean(node.partnerInstruction?.wait);
      const terminal = Boolean(node.ending);
      const special =
        Boolean(node.dynamicDuoComparison) ||
        Boolean(node.encounterSpecial) ||
        Boolean(node.encounterNeedsReview) ||
        Boolean(node.needsManualReview);
      return targets.length === 0 && !waiting && !terminal && !special;
    })
    .sort((a, b) => a - b);

  const endings = Object.entries(refs)
    .filter(([, node]) => node.ending)
    .map(([id, node]) => ({
      id: Number(id),
      ending: node.ending
    }));

  const missingReferences = [];
  for (let id = 1; id <= 500; id += 1) {
    if (!ids.has(id)) missingReferences.push(id);
  }

  return {
    references: ids.size,
    coveragePercent: Number(((ids.size / 500) * 100).toFixed(1)),
    edges: [...edges.values()].reduce(
      (sum, targets) => sum + targets.length,
      0
    ),
    invalidTargets,
    targetsToUnextractedReferences,
    reachableExtractedFrom1: reachable.size,
    unreachableExtractedCount: unreachableExtracted.length,
    unreachableExtracted,
    missingReferenceCount: missingReferences.length,
    missingReferences,
    deadEnds,
    endings,
    completeExpected: Boolean(options.completeExpected)
  };
}

const [colthar, lothar] = await Promise.all([
  readJSON("jogos/furia-de-principes/data/colthar.json"),
  readJSON("jogos/furia-de-principes/data/lothar.json")
]);

const report = {
  colthar: analyzeCharacter(colthar, {
    completeExpected: false
  }),
  lothar: analyzeCharacter(lothar, {
    completeExpected: true
  })
};

console.log(JSON.stringify(report, null, 2));

const fatalProblems = [
  ...report.colthar.invalidTargets,
  ...report.lothar.invalidTargets
];

if (
  report.lothar.references !== 500 ||
  report.lothar.targetsToUnextractedReferences.length > 0 ||
  fatalProblems.length > 0
) {
  process.exit(1);
}
