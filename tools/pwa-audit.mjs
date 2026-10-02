import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const issues = [];
const warnings = [];

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function readBuffer(relativePath) {
  return fs.readFile(path.join(root, relativePath));
}

async function readPngSize(relativePath) {
  const buffer = await readBuffer(relativePath);
  const signature = "89504e470d0a1a0a";

  if (
    buffer.length < 24 ||
    buffer.subarray(0, 8).toString("hex") !== signature
  ) {
    return null;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return `${width}x${height}`;
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
  const match = swText.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (!match) return [];

  return [...match[1].matchAll(/["']([^"']+)["']/g)]
    .map(entry => normalizeShellPath(entry[1]));
}

function extractStaticImports(jsText) {
  const imports = new Set();

  for (const match of jsText.matchAll(
    /(?:import\s+(?:[^"'()]*?\s+from\s+)?|export\s+[^"'()]*?\s+from\s+)["']([^"']+)["']/g
  )) {
    imports.add(match[1]);
  }

  for (const match of jsText.matchAll(
    /import\(\s*["']([^"']+)["']\s*\)/g
  )) {
    imports.add(match[1]);
  }

  return [...imports];
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), specifier)
  );

  return resolved.replace(/^\.\//, "");
}

async function collectJsDependencyClosure(entryFile) {
  const pending = [entryFile];
  const visited = new Set();

  while (pending.length) {
    const current = pending.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (!(await exists(current))) {
      issues.push(`Módulo importado inexistente: ${current}`);
      continue;
    }

    const source = await readText(current);

    for (const specifier of extractStaticImports(source)) {
      const resolved = resolveImport(current, specifier);
      if (!resolved) continue;

      const candidate = path.posix.extname(resolved)
        ? resolved
        : resolved + ".js";

      if (!visited.has(candidate)) pending.push(candidate);
    }
  }

  return visited;
}

const [manifest, swText, indexText, appText, catalog] =
  await Promise.all([
    readJSON("manifest.webmanifest"),
    readText("sw.js"),
    readText("index.html"),
    readText("src/app.js"),
    readJSON("jogos/catalogo.json")
  ]);

const shell = extractAppShell(swText);
const shellSet = new Set(shell);

if (!shell.length) {
  issues.push("APP_SHELL não pôde ser extraído de sw.js");
}

for (const shellPath of shell) {
  if (!(await exists(shellPath))) {
    issues.push(`Arquivo do APP_SHELL não existe: ${shellPath}`);
  }
}

for (const required of [
  "index.html",
  "manifest.webmanifest",
  "src/app.js",
  "src/style.css",
  "jogos/catalogo.json"
]) {
  if (!shellSet.has(required)) {
    issues.push(`Arquivo essencial fora do APP_SHELL: ${required}`);
  }
}

if (!manifest.name || !manifest.short_name) {
  issues.push("Manifesto precisa de name e short_name");
}

if (manifest.start_url !== "./") {
  issues.push("Manifesto deve manter start_url relativo './'");
}

if (manifest.scope !== "./") {
  issues.push("Manifesto deve manter scope relativo './'");
}

if (manifest.display !== "standalone") {
  issues.push("Manifesto deve usar display 'standalone'");
}

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  issues.push("Manifesto não possui ícones");
} else {
  for (const icon of manifest.icons) {
    const iconPath = normalizeShellPath(icon.src || "");
    if (!iconPath || !(await exists(iconPath))) {
      issues.push(`Ícone do manifesto inexistente: ${icon.src || "(vazio)"}`);
      continue;
    }

    if (!shellSet.has(iconPath)) {
      issues.push(`Ícone do manifesto fora do APP_SHELL: ${iconPath}`);
    }
  }

  const rasterSizes = new Set();

  for (const icon of manifest.icons) {
    if (icon.type !== "image/png") continue;

    const iconPath = normalizeShellPath(icon.src || "");
    if (!iconPath || !(await exists(iconPath))) continue;

    const actualSize = await readPngSize(iconPath);

    if (!actualSize) {
      issues.push(`Ícone PNG inválido: ${iconPath}`);
      continue;
    }

    rasterSizes.add(actualSize);

    const declaredSizes = new Set(
      String(icon.sizes || "").split(/\s+/).filter(Boolean)
    );

    if (!declaredSizes.has(actualSize)) {
      issues.push(
        `Ícone ${iconPath} declara ${icon.sizes || "(sem sizes)"}, mas mede ${actualSize}`
      );
    }
  }

  if (!rasterSizes.has("192x192") || !rasterSizes.has("512x512")) {
    issues.push(
      "Manifesto precisa de ícones PNG reais 192x192 e 512x512."
    );
  }
}

if (!/<link\s+rel=["']manifest["']\s+href=["']manifest\.webmanifest["']/.test(indexText)) {
  issues.push("index.html não referencia manifest.webmanifest");
}

if (!/<script\s+type=["']module["']\s+src=["']src\/app\.js["']/.test(indexText)) {
  issues.push("index.html não carrega src/app.js como módulo");
}

if (!/navigator\.serviceWorker\.register\(["']\.\/sw\.js["']\)/.test(appText)) {
  issues.push("src/app.js não registra ./sw.js");
}

for (const eventName of ["install", "activate", "fetch"]) {
  const pattern = new RegExp(
    `self\\.addEventListener\\(["']${eventName}["']`
  );
  if (!pattern.test(swText)) {
    issues.push(`Service Worker não implementa evento ${eventName}`);
  }
}

if (!/const\s+CACHE_NAME\s*=\s*["'][^"']+["']/.test(swText)) {
  issues.push("sw.js não declara CACHE_NAME");
}

const jsClosure = await collectJsDependencyClosure("src/app.js");

for (const jsFile of jsClosure) {
  if (!shellSet.has(jsFile)) {
    issues.push(`Módulo JS necessário fora do APP_SHELL: ${jsFile}`);
  }
}

let gameDependencyCount = 0;

for (const game of catalog.games || []) {
  if (!game.config) {
    issues.push(`Jogo sem config no catálogo: ${game.id || "(sem id)"}`);
    continue;
  }

  const configPath = normalizeShellPath(game.config);

  if (!(await exists(configPath))) {
    issues.push(`Config de jogo inexistente: ${configPath}`);
    continue;
  }

  if (!shellSet.has(configPath)) {
    issues.push(`Config de jogo fora do APP_SHELL: ${configPath}`);
  }

  const config = await readJSON(configPath);
  const baseDir = path.posix.dirname(configPath);
  const dependencies = [];

  for (const character of config.characters || []) {
    if (character.data) {
      dependencies.push(path.posix.join(baseDir, character.data));
    }
  }

  if (config.sync) {
    dependencies.push(path.posix.join(baseDir, config.sync));
  }

  for (const rulePath of Object.values(config.rules || {})) {
    dependencies.push(path.posix.join(baseDir, rulePath));
  }

  for (const dependency of dependencies) {
    gameDependencyCount += 1;

    if (!(await exists(dependency))) {
      issues.push(`Dependência do jogo inexistente: ${dependency}`);
    }

    if (!shellSet.has(dependency)) {
      issues.push(`Dependência do jogo fora do APP_SHELL: ${dependency}`);
    }
  }
}

const report = {
  cacheName:
    swText.match(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']/)?.[1] ||
    null,
  appShellEntries: shell.length,
  jsModulesRequired: jsClosure.size,
  gameDependenciesChecked: gameDependencyCount,
  manifestIcons: manifest.icons?.length || 0,
  rasterIconSizes: manifest.icons
    ?.filter(icon => icon.type === "image/png")
    .map(icon => icon.sizes) || [],
  warnings,
  issues
};

console.log(JSON.stringify(report, null, 2));

if (issues.length) {
  process.exit(1);
}
