import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const CHARACTERS = ["colthar", "lothar"];

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function otherCharacter(character) {
  return character === "colthar" ? "lothar" : "colthar";
}

function addTarget(set, value) {
  const target = Number(value);
  if (Number.isInteger(target)) set.add(target);
}

function selfTargets(node, syncEntry) {
  const targets = new Set();

  for (const choice of node.choices || []) {
    addTarget(targets, choice.target);
  }
  for (const choice of node.failureChoices || []) {
    addTarget(targets, choice.target);
  }
  for (const choice of node.postVictoryChoices || []) {
    addTarget(targets, choice.target);
  }
  for (const route of node.roll?.routes || []) {
    addTarget(targets, route.target);
  }
  for (const route of node.partnerRollRoutes || []) {
    addTarget(targets, route.target);
  }
  for (const route of node.partnerOutcomeRoutes || []) {
    addTarget(targets, route.target);
  }
  for (const spell of node.spellOptions || []) {
    addTarget(targets, spell.successTarget);
  }
  for (const route of syncEntry?.routes || []) {
    addTarget(targets, route.target);
  }

  addTarget(targets, node.test?.successTarget);
  addTarget(targets, node.test?.failureTarget);
  addTarget(targets, node.onVictory);
  addTarget(targets, node.onDefeat);
  addTarget(targets, node.failureTarget);
  addTarget(targets, node.rollAgainstStat?.successTarget);
  addTarget(targets, node.rollAgainstStat?.failureTarget);
  addTarget(targets, node.dynamicCondition?.trueTarget);
  addTarget(targets, node.dynamicCondition?.falseTarget);
  addTarget(targets, node.dynamicChoice?.failureTarget);
  addTarget(targets, node.encounterSpecial?.roundRoll?.target);
  addTarget(targets, node.encounterSpecial?.onVictory);
  addTarget(targets, node.playerEffectChoice?.continueTarget);
  addTarget(targets, node.referenceInput?.fallbackTarget);
  addTarget(targets, node.merchant?.continueTarget);

  if (node.dynamicDuoComparison) {
    addTarget(
      targets,
      node.dynamicDuoComparison.partnerGreaterTarget
    );
    addTarget(
      targets,
      node.dynamicDuoComparison.selfGreaterTarget
    );
    addTarget(
      targets,
      node.dynamicDuoComparison.equalTarget
    );
  }

  return [...targets];
}

function partnerTargets(node) {
  const targets = new Set();

  for (const choice of node.choices || []) {
    addTarget(targets, choice.partnerTarget);
  }

  addTarget(targets, node.partnerOnFailure);
  addTarget(targets, node.partnerOnDefeat);
  addTarget(targets, node.partnerOnVictory);
  addTarget(
    targets,
    node.partnerInstruction?.sendToReference
  );

  for (
    const route of
    node.partnerInstruction?.conditionalSend || []
  ) {
    addTarget(targets, route.target);
  }

  return [...targets];
}

function syncEntryFor(syncEntries, character, reference) {
  return syncEntries.find(
    entry =>
      entry.character === character &&
      Number(entry.reference) === Number(reference)
  ) || null;
}

function isExplainedOpenNode(node, syncEntry) {
  return Boolean(
    node.ending ||
    node.partnerInstruction?.wait ||
    syncEntry?.waitFor ||
    node.encounterNeedsReview ||
    node.needsManualReview ||
    node.needsMoreExtraction ||
    node.needsEngineSupport ||
    node.onVictoryNeedsReview ||
    node.referenceInput ||
    node.dynamicChoice
  );
}

function analyzeCharacter(
  character,
  data,
  partnerData,
  syncEntries
) {
  const refs = data.references || {};
  const partnerRefs = partnerData.references || {};
  const ids = new Set(Object.keys(refs).map(Number));
  const partnerIds = new Set(
    Object.keys(partnerRefs).map(Number)
  );
  const selfEdges = new Map();
  const crossEdges = new Map();
  const invalidTargets = [];
  const targetsToMissingReferences = [];

  for (const [idText, node] of Object.entries(refs)) {
    const id = Number(idText);
    const syncEntry = syncEntryFor(
      syncEntries,
      character,
      id
    );
    const ownTargets = selfTargets(node, syncEntry);
    const otherTargets = partnerTargets(node);

    selfEdges.set(id, ownTargets);
    crossEdges.set(id, otherTargets);

    for (const target of ownTargets) {
      if (target < 1 || target > 500) {
        invalidTargets.push({
          from: id,
          kind: "self",
          target
        });
      } else if (!ids.has(target)) {
        targetsToMissingReferences.push({
          from: id,
          kind: "self",
          target
        });
      }
    }

    for (const target of otherTargets) {
      if (target < 1 || target > 500) {
        invalidTargets.push({
          from: id,
          kind: "partner",
          target
        });
      } else if (!partnerIds.has(target)) {
        targetsToMissingReferences.push({
          from: id,
          kind: "partner",
          target
        });
      }
    }
  }

  const reachable = new Set();
  const queue = [1];

  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id) || !ids.has(id)) continue;
    reachable.add(id);

    for (const target of selfEdges.get(id) || []) {
      if (!reachable.has(target) && ids.has(target)) {
        queue.push(target);
      }
    }
  }

  const unreachable = [...ids]
    .filter(id => !reachable.has(id))
    .sort((a, b) => a - b);

  const deadEnds = [...ids]
    .filter(id => {
      const node = refs[String(id)];
      const syncEntry = syncEntryFor(
        syncEntries,
        character,
        id
      );
      const outgoingCount =
        (selfEdges.get(id) || []).length +
        (crossEdges.get(id) || []).length;

      return (
        outgoingCount === 0 &&
        !isExplainedOpenNode(node, syncEntry)
      );
    })
    .sort((a, b) => a - b);

  const endings = Object.entries(refs)
    .filter(([, node]) => node.ending)
    .map(([id, node]) => ({
      id: Number(id),
      ending: node.ending
    }));

  const openReferenceInputs = Object.entries(refs)
    .filter(
      ([, node]) =>
        node.referenceInput ||
        node.dynamicChoice?.type === "numeric-riddle"
    )
    .map(([id]) => Number(id));

  return {
    references: ids.size,
    coveragePercent: Number(
      ((ids.size / 500) * 100).toFixed(1)
    ),
    selfEdges: [...selfEdges.values()].reduce(
      (sum, targets) => sum + targets.length,
      0
    ),
    partnerEdges: [...crossEdges.values()].reduce(
      (sum, targets) => sum + targets.length,
      0
    ),
    invalidTargets,
    targetsToMissingReferences,
    soloReachableFrom1: reachable.size,
    soloUnreachableCount: unreachable.length,
    soloUnreachable: unreachable,
    deadEnds,
    endings,
    openReferenceInputs,
    selfEdgesMap: selfEdges,
    crossEdgesMap: crossEdges
  };
}

function analyzeCombinedDuo(characterReports) {
  const graph = new Map();
  const reverse = new Map();

  for (const character of CHARACTERS) {
    const report = characterReports[character];
    const partner = otherCharacter(character);

    for (
      let reference = 1;
      reference <= 500;
      reference += 1
    ) {
      const key = `${character}:${reference}`;
      const targets = [];

      for (
        const target of
        report.selfEdgesMap.get(reference) || []
      ) {
        targets.push(`${character}:${target}`);
      }

      for (
        const target of
        report.crossEdgesMap.get(reference) || []
      ) {
        targets.push(`${partner}:${target}`);
      }

      const uniqueTargets = [...new Set(targets)];
      graph.set(key, uniqueTargets);

      for (const target of uniqueTargets) {
        if (!reverse.has(target)) {
          reverse.set(target, []);
        }
        reverse.get(target).push(key);
      }
    }
  }

  const reachable = new Set();
  const queue = ["colthar:1", "lothar:1"];

  while (queue.length) {
    const key = queue.shift();
    if (reachable.has(key) || !graph.has(key)) {
      continue;
    }

    reachable.add(key);

    for (const target of graph.get(key) || []) {
      if (!reachable.has(target)) queue.push(target);
    }
  }

  const allNodes = [...graph.keys()];
  const unreachable = allNodes.filter(
    key => !reachable.has(key)
  );
  const unreachableSet = new Set(unreachable);
  const unreachableEntryPoints = unreachable
    .filter(key => {
      const incoming = reverse.get(key) || [];
      return incoming.every(
        source => !unreachableSet.has(source)
      );
    })
    .sort();

  return {
    totalNodes: allNodes.length,
    reachableNodes: reachable.size,
    reachablePercent: Number(
      ((reachable.size / allNodes.length) * 100).toFixed(1)
    ),
    unreachableCount: unreachable.length,
    unreachable,
    unreachableEntryPoints
  };
}

const [colthar, lothar, syncData] = await Promise.all([
  readJSON(
    "jogos/furia-de-principes/data/colthar.json"
  ),
  readJSON(
    "jogos/furia-de-principes/data/lothar.json"
  ),
  readJSON(
    "jogos/furia-de-principes/data/sincronizacao.json"
  )
]);

const syncEntries = syncData.entries || [];
const characterReports = {
  colthar: analyzeCharacter(
    "colthar",
    colthar,
    lothar,
    syncEntries
  ),
  lothar: analyzeCharacter(
    "lothar",
    lothar,
    colthar,
    syncEntries
  )
};

const combinedDuo = analyzeCombinedDuo(
  characterReports
);

const report = {
  colthar: {
    ...characterReports.colthar,
    selfEdgesMap: undefined,
    crossEdgesMap: undefined
  },
  lothar: {
    ...characterReports.lothar,
    selfEdgesMap: undefined,
    crossEdgesMap: undefined
  },
  combinedDuo
};

console.log(JSON.stringify(report, null, 2));

const fatalProblems = [
  ...report.colthar.invalidTargets,
  ...report.lothar.invalidTargets,
  ...report.colthar.targetsToMissingReferences,
  ...report.lothar.targetsToMissingReferences
];

if (
  report.colthar.references !== 500 ||
  report.lothar.references !== 500 ||
  report.colthar.deadEnds.length > 0 ||
  report.lothar.deadEnds.length > 0 ||
  fatalProblems.length > 0
) {
  process.exit(1);
}
