import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const ALLOWED_ENDINGS = new Set([
  "death",
  "removed",
  "removed-transition",
  "success"
]);

async function readJSON(path) {
  return JSON.parse(
    await fs.readFile(new URL(path, root), "utf8")
  );
}

function classifyCharacter(character, data) {
  const refs = data.references || {};
  const endings = {};
  const successRefs = [];
  const terminalRefs = [];
  const issues = [];

  const encounters = {
    structured: 0,
    dynamic: 0,
    needsReview: 0,
    cooperative: 0,
    combatMagicAllowed: 0,
    combatMagicForbidden: 0,
    specialRules: 0
  };

  for (const [refText, node] of Object.entries(refs)) {
    const ref = Number(refText);

    if (node.ending) {
      if (!ALLOWED_ENDINGS.has(node.ending)) {
        issues.push(
          `${character} ${ref}: tipo de final desconhecido ${node.ending}`
        );
      }

      endings[node.ending] =
        Number(endings[node.ending] || 0) + 1;
      terminalRefs.push({
        reference: ref,
        ending: node.ending
      });

      if (node.ending === "success") {
        successRefs.push(ref);
      }
    }

    if (node.encounter) {
      encounters.structured += 1;

      if (node.encounter.cooperative) {
        encounters.cooperative += 1;
      }
      if (node.encounter.allowCombatMagic) {
        encounters.combatMagicAllowed += 1;
      }
      if (node.encounter.noCombatMagic) {
        encounters.combatMagicForbidden += 1;
      }

      const hasResolution = Boolean(
        node.onVictory ||
        node.onDefeat ||
        node.postVictoryChoices?.length ||
        node.choices?.length ||
        node.encounterSpecial?.onVictory
      );

      if (
        !hasResolution &&
        !node.onVictoryNeedsReview &&
        !node.encounterNeedsReview
      ) {
        issues.push(
          `${character} ${ref}: encontro estruturado sem resolução`
        );
      }
    }

    if (node.encounterDynamic) {
      encounters.structured += 1;
      encounters.dynamic += 1;
    }

    if (node.encounterNeedsReview) {
      encounters.needsReview += 1;

      if (node.estado !== "parcial") {
        issues.push(
          `${character} ${ref}: encontro em revisão deve permanecer parcial`
        );
      }
    }

    if (node.encounterSpecial) {
      encounters.specialRules += 1;
    }
  }

  if (
    successRefs.length !== 1 ||
    successRefs[0] !== 500
  ) {
    issues.push(
      `${character}: sucesso deve existir uma única vez na referência 500; encontrado em [${successRefs.join(", ")}]`
    );
  }

  return {
    report: {
      references: Object.keys(refs).length,
      endings,
      terminalCount: terminalRefs.length,
      terminalRefs,
      successRefs,
      encounters
    },
    issues
  };
}

const [colthar, lothar] = await Promise.all([
  readJSON(
    "jogos/furia-de-principes/data/colthar.json"
  ),
  readJSON(
    "jogos/furia-de-principes/data/lothar.json"
  )
]);

const coltharResult = classifyCharacter(
  "colthar",
  colthar
);
const lotharResult = classifyCharacter(
  "lothar",
  lothar
);

const issues = [
  ...coltharResult.issues,
  ...lotharResult.issues
];

const report = {
  colthar: coltharResult.report,
  lothar: lotharResult.report,
  combined: {
    terminalCount:
      coltharResult.report.terminalCount +
      lotharResult.report.terminalCount,
    structuredEncounters:
      coltharResult.report.encounters.structured +
      lotharResult.report.encounters.structured,
    encountersNeedingReview:
      coltharResult.report.encounters.needsReview +
      lotharResult.report.encounters.needsReview,
    issues
  }
};

console.log(JSON.stringify(report, null, 2));

if (issues.length > 0) {
  process.exit(1);
}
