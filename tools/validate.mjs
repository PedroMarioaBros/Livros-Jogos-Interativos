import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const jsonFiles = [
  "manifest.webmanifest",
  "jogos/catalogo.json",
  "jogos/furia-de-principes/game.json",
  "jogos/furia-de-principes/data/colthar.json",
  "jogos/furia-de-principes/data/lothar.json",
  "jogos/furia-de-principes/data/sincronizacao.json",
  "jogos/furia-de-principes/rules/base.json",
  "jogos/furia-de-principes/rules/spells.json"
];

let errors = 0;
let warnings = 0;

function log(kind, message) {
  const prefix = kind === "error" ? "ERRO" : "AVISO";
  console.log(`[${prefix}] ${message}`);
  if (kind === "error") errors++;
  else warnings++;
}

async function readJSON(path) {
  return JSON.parse(await fs.readFile(new URL(path, root), "utf8"));
}

for (const path of jsonFiles) {
  try {
    await readJSON(path);
    console.log(`[OK] JSON válido: ${path}`);
  } catch (error) {
    log("error", `JSON inválido em ${path}: ${error.message}`);
  }
}

for (const character of ["colthar", "lothar"]) {
  const path = `jogos/furia-de-principes/data/${character}.json`;
  const data = await readJSON(path);
  const refs = data.references ?? {};

  if (data.startingResources?.provisions !== 10) {
    log("warning", `${character}: quantidade inicial de provisões diferente de 10`);
  }

  for (const [id, node] of Object.entries(refs)) {
    const number = Number(id);
    if (!Number.isInteger(number) || number < 1 || number > 500) {
      log("error", `${character}: referência fora do intervalo 1–500: ${id}`);
    }

    const checkTarget = (target, label) => {
      if (!Number.isInteger(target)) {
        log("error", `${character} ${id}: ${label} não inteiro`);
        return;
      }

      if (target < 1 || target > 500) {
        log("error", `${character} ${id}: ${label} fora de 1–500: ${target}`);
        return;
      }

      if (!refs[String(target)]) {
        log("warning", `${character} ${id}: ${label} ${target} ainda não foi cadastrado`);
      }
    };

    for (const choice of node.choices ?? []) {
      checkTarget(choice.target, "destino");
    }

    if (node.test?.successTarget) {
      checkTarget(node.test.successTarget, "sucesso do teste");
    }
    if (node.test?.failureTarget) {
      checkTarget(node.test.failureTarget, "falha do teste");
    }
    if (node.onVictory) {
      checkTarget(node.onVictory, "vitória");
    }
    if (node.onDefeat) {
      checkTarget(node.onDefeat, "derrota");
    }
    if (node.failureTarget) {
      checkTarget(node.failureTarget, "falha de feitiço");
    }

    for (const spell of node.spellOptions ?? []) {
      if (!Number.isInteger(spell.cost) || spell.cost < 1) {
        log("error", `${character} ${id}: custo inválido em feitiço situacional`);
      }
      checkTarget(spell.successTarget, "sucesso de feitiço");
    }

    for (const route of node.roll?.routes ?? []) {
      checkTarget(route.target, "rota de dado");
    }

    for (const enemy of node.encounter?.enemies ?? []) {
      if (
        !Number.isFinite(Number(enemy.habilidade)) ||
        !Number.isFinite(Number(enemy.energia)) ||
        Number(enemy.habilidade) <= 0 ||
        Number(enemy.energia) <= 0
      ) {
        log("error", `${character} ${id}: atributos inválidos no encontro ${enemy.name || "sem nome"}`);
      }
    }

    const allowedStates = new Set([
      "pendente",
      "parcial",
      "extraida",
      "validada",
      "implementada",
      "testada"
    ]);

    if (!allowedStates.has(node.estado)) {
      log("error", `${character} ${id}: estado inválido ${node.estado}`);
    }
  }
}

const completeBooks = {};

for (const character of ["colthar", "lothar"]) {
  const data = await readJSON(
    `jogos/furia-de-principes/data/${character}.json`
  );
  completeBooks[character] = data;

  const ids = Object.keys(data.references || {})
    .map(Number)
    .sort((a, b) => a - b);

  if (ids.length !== 500) {
    log(
      "error",
      `${character}: possui ${ids.length} referências; esperado: 500`
    );
  }

  for (let id = 1; id <= 500; id += 1) {
    if (!data.references[String(id)]) {
      log("error", `${character}: referência ausente ${id}`);
    }
  }
}

const syncData = await readJSON(
  "jogos/furia-de-principes/data/sincronizacao.json"
);
const syncEntries = syncData.entries || [];
const syncKeys = new Set();

for (const entry of syncEntries) {
  const key = `${entry.character}:${Number(entry.reference)}`;

  if (!["colthar", "lothar"].includes(entry.character)) {
    log("error", `sincronização com personagem inválido: ${entry.character}`);
    continue;
  }

  if (
    !Number.isInteger(Number(entry.reference)) ||
    Number(entry.reference) < 1 ||
    Number(entry.reference) > 500
  ) {
    log(
      "error",
      `sincronização ${key}: referência inválida`
    );
    continue;
  }

  if (syncKeys.has(key)) {
    log("error", `sincronização duplicada: ${key}`);
  }
  syncKeys.add(key);

  if (!completeBooks[entry.character].references[String(entry.reference)]) {
    log("error", `sincronização ${key}: referência inexistente`);
  }

  if (entry.verified !== true) {
    log("warning", `sincronização ${key}: ainda não verificada`);
  }

  for (const effect of entry.effects || []) {
    if (effect.type !== "set_shared") continue;

    if (!["status", "acao"].includes(effect.key)) {
      log(
        "error",
        `sincronização ${key}: chave compartilhada inválida ${effect.key}`
      );
    }

    if (!Number.isInteger(Number(effect.value))) {
      log(
        "error",
        `sincronização ${key}: valor compartilhado inválido ${effect.value}`
      );
    }
  }

  for (const route of entry.routes || []) {
    const target = Number(route.target);
    if (
      !Number.isInteger(target) ||
      target < 1 ||
      target > 500
    ) {
      log(
        "error",
        `sincronização ${key}: destino inválido ${route.target}`
      );
      continue;
    }

    if (!completeBooks[entry.character].references[String(target)]) {
      log(
        "error",
        `sincronização ${key}: destino inexistente ${target}`
      );
    }
  }
}

for (const character of ["colthar", "lothar"]) {
  const refs = completeBooks[character].references || {};

  for (const [reference, node] of Object.entries(refs)) {
    const sharedEffects = (node.effects || []).filter(
      effect =>
        effect.type === "set_shared" &&
        ["status", "acao"].includes(effect.key)
    );

    if (sharedEffects.length === 0) continue;

    const entry = syncEntries.find(
      item =>
        item.character === character &&
        Number(item.reference) === Number(reference)
    );

    if (!entry) {
      log(
        "error",
        `${character} ${reference}: set_shared STATUS/AÇÃO sem entrada em sincronizacao.json`
      );
      continue;
    }

    for (const effect of sharedEffects) {
      const mirrored = (entry.effects || []).some(
        syncEffect =>
          syncEffect.type === "set_shared" &&
          syncEffect.key === effect.key &&
          Number(syncEffect.value) === Number(effect.value)
      );

      if (!mirrored) {
        log(
          "error",
          `${character} ${reference}: efeito ${effect.key}=${effect.value} não espelhado em sincronizacao.json`
        );
      }
    }
  }
}

const spellData = await readJSON("jogos/furia-de-principes/rules/spells.json");
const spellIds = new Set();

if (spellData.spells.length !== 12) {
  log("error", `catálogo de magia possui ${spellData.spells.length} feitiços; esperado: 12`);
}

for (const spell of spellData.spells) {
  if (!spell.id || spellIds.has(spell.id)) {
    log("error", `ID de feitiço ausente ou duplicado: ${spell.id}`);
  }
  spellIds.add(spell.id);

  if (!(Number.isInteger(spell.cost) && spell.cost > 0) && spell.cost !== "variable") {
    log("error", `custo inválido no feitiço ${spell.id}`);
  }
}

console.log(`Validação concluída: ${errors} erro(s), ${warnings} aviso(s).`);
if (errors > 0) process.exit(1);
