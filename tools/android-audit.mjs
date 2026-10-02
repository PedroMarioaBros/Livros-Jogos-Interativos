import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const issues = [];

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function readJSON(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function normalizeShellPath(value) {
  if (value === "./") return "index.html";
  return value.replace(/^\.\//, "");
}

function extractAppShell(swText) {
  const match = swText.match(
    /const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/
  );

  if (!match) return [];

  return [...match[1].matchAll(/["']([^"']+)["']/g)]
    .map(entry => normalizeShellPath(entry[1]));
}

const [config, pkg] = await Promise.all([
  readJSON("capacitor.config.json"),
  readJSON("package.json")
]);

if (config.webDir !== "www") {
  issues.push("Capacitor deve usar webDir 'www'.");
}

if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(config.appId || "")) {
  issues.push("appId do Capacitor não é um applicationId Android válido.");
}

if (!config.appName) {
  issues.push("Capacitor precisa de appName.");
}

const versions = {
  core: pkg.dependencies?.["@capacitor/core"],
  android: pkg.dependencies?.["@capacitor/android"],
  cli: pkg.devDependencies?.["@capacitor/cli"]
};

if (Object.values(versions).some(value => !value)) {
  issues.push("Pacotes obrigatórios do Capacitor não estão declarados.");
}

const declaredVersions = new Set(
  Object.values(versions).filter(Boolean)
);

if (declaredVersions.size > 1) {
  issues.push(
    "Core, Android e CLI do Capacitor precisam usar a mesma versão."
  );
}

for (const [name, version] of Object.entries(versions)) {
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    issues.push(
      `Versão de Capacitor ${name} deve ser fixa, sem ^ ou ~: ${version}`
    );
  }
}

for (const script of [
  "build:web",
  "android:audit",
  "android:add",
  "android:sync",
  "android:open"
]) {
  if (!pkg.scripts?.[script]) {
    issues.push(`Script npm ausente: ${script}`);
  }
}

const webDir = config.webDir || "www";

const criticalFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/app-icon.svg",
  "assets/app-icon-192.png",
  "assets/app-icon-512.png",
  "src/app.js",
  "src/style.css",
  "jogos/catalogo.json",
  "jogos/furia-de-principes/game.json"
];

for (const file of criticalFiles) {
  if (!(await exists(path.posix.join(webDir, file)))) {
    issues.push(`Arquivo ausente no build Android: ${file}`);
  }
}

for (const forbidden of [
  "docs",
  "tests",
  "tools",
  "package.json"
]) {
  if (await exists(path.posix.join(webDir, forbidden))) {
    issues.push(
      `Conteúdo de desenvolvimento não deve ir para www/: ${forbidden}`
    );
  }
}

let shell = [];

if (await exists(path.posix.join(webDir, "sw.js"))) {
  const swText = await readText(path.posix.join(webDir, "sw.js"));
  shell = extractAppShell(swText);

  if (!shell.length) {
    issues.push("APP_SHELL não pôde ser extraído do www/sw.js.");
  }

  for (const shellPath of shell) {
    if (!(await exists(path.posix.join(webDir, shellPath)))) {
      issues.push(
        `Recurso do APP_SHELL ausente em www/: ${shellPath}`
      );
    }
  }
}

if (await exists(path.posix.join(webDir, "index.html"))) {
  const indexText = await readText(
    path.posix.join(webDir, "index.html")
  );

  if (!/<head(?:\s|>)/i.test(indexText)) {
    issues.push(
      "www/index.html precisa de <head> para integração com Capacitor."
    );
  }
}

const report = {
  appId: config.appId || null,
  appName: config.appName || null,
  webDir,
  capacitorVersions: versions,
  criticalFilesChecked: criticalFiles.length,
  appShellEntriesChecked: shell.length,
  issues
};

console.log(JSON.stringify(report, null, 2));

if (issues.length) {
  process.exit(1);
}
