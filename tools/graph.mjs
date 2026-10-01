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
  addTarget(targets, node.partnerInstruction?.sendToReference);
  addTarget(targets, node.rollAgainstStat?.successTarget);
  addTarget(targets, node.rollAgainstStat?.failureTarget);
  addTarget(targets, node.dynamicCondition?.trueTarget);
  addTarget(targets, node.dynamicCondition?.falseTarget);
  addTarget(targets, node.dynamicChoice?.failureTarget);

  if (node.merchant) addTarget(targets, node.merchant.continueTarget);

  return [...targets];
}

const data = await readJSON(
  "jogos/furia-de-principes/data/lothar.json"
);

const refs = data.references || {};
const ids = new Set(Object.keys(refs).map(Number));
const broken = [];
const edges = new Map();

for (const [idText, node] of Object.entries(refs)) {
  const id = Number(idText);
  const targets = nodeTargets(node);
  edges.set(id, targets);

  for (const target of targets) {
    if (!ids.has(target)) {
      broken.push({ from: id, target });
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
    if (!reachable.has(target)) queue.push(target);
  }
}

const unreachable = [...ids]
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
      Boolean(node.encounterSpecial);
    return targets.length === 0 && !waiting && !terminal && !special;
  })
  .sort((a, b) => a - b);

const endings = Object.entries(refs)
  .filter(([, node]) => node.ending)
  .map(([id, node]) => ({
    id: Number(id),
    ending: node.ending
  }));

const report = {
  references: ids.size,
  edges: [...edges.values()].reduce(
    (sum, targets) => sum + targets.length,
    0
  ),
  brokenTargets: broken,
  reachableFrom1: reachable.size,
  unreachableCount: unreachable.length,
  unreachable,
  deadEnds,
  endings
};

console.log(JSON.stringify(report, null, 2));

if (broken.length > 0) {
  process.exit(1);
}
