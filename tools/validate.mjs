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

    for (const choice of node.choices ?? []) {
      if (!Number.isInteger(choice.target)) {
        log("error", `${character} ${id}: destino não inteiro`);
        continue;
      }

      if (choice.target < 1 || choice.target > 500) {
        log("error", `${character} ${id}: destino fora de 1–500: ${choice.target}`);
      }

      if (!refs[String(choice.target)]) {
        log("warning", `${character} ${id}: destino ${choice.target} ainda não foi cadastrado`);
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
