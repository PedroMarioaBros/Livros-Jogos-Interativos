import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = [
  "jogos/furia-de-principes/data/colthar.json",
  "jogos/furia-de-principes/data/lothar.json",
  "jogos/furia-de-principes/data/sincronizacao.json"
];

let errors = 0;
let warnings = 0;

function log(kind, message) {
  const prefix = kind === "error" ? "ERRO" : "AVISO";
  console.log(`[${prefix}] ${message}`);
  if (kind === "error") errors++;
  else warnings++;
}

for (const path of files) {
  try {
    JSON.parse(await fs.readFile(new URL(path, root), "utf8"));
    console.log(`[OK] JSON válido: ${path}`);
  } catch (error) {
    log("error", `JSON inválido em ${path}: ${error.message}`);
  }
}

for (const character of ["colthar", "lothar"]) {
  const path = `jogos/furia-de-principes/data/${character}.json`;
  const data = JSON.parse(await fs.readFile(new URL(path, root), "utf8"));
  const refs = data.references ?? {};

  for (const [id, node] of Object.entries(refs)) {
    if (!/^\d+$/.test(id)) log("error", `${character}: referência inválida ${id}`);

    for (const choice of node.choices ?? []) {
      if (!Number.isInteger(choice.target)) {
        log("error", `${character} ${id}: destino não inteiro`);
        continue;
      }

      if (!refs[String(choice.target)]) {
        log("warning", `${character} ${id}: destino ${choice.target} ainda não foi cadastrado`);
      }
    }
  }
}

console.log(`Validação concluída: ${errors} erro(s), ${warnings} aviso(s).`);
if (errors > 0) process.exit(1);
