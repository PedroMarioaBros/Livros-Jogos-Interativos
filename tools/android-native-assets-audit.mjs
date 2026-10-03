import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const resRoot = path.join(root, "android", "app", "src", "main", "res");
const issues = [];
const checked = [];

async function read(relativePath, encoding = null) {
  return fs.readFile(path.join(resRoot, relativePath), encoding ?? undefined);
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(resRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function pngDimensions(buffer) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("assinatura PNG inválida");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const legacyIcons = [
  ["mipmap-mdpi/ic_launcher.png", 48],
  ["mipmap-hdpi/ic_launcher.png", 72],
  ["mipmap-xhdpi/ic_launcher.png", 96],
  ["mipmap-xxhdpi/ic_launcher.png", 144],
  ["mipmap-xxxhdpi/ic_launcher.png", 192],
  ["mipmap-mdpi/ic_launcher_round.png", 48],
  ["mipmap-hdpi/ic_launcher_round.png", 72],
  ["mipmap-xhdpi/ic_launcher_round.png", 96],
  ["mipmap-xxhdpi/ic_launcher_round.png", 144],
  ["mipmap-xxxhdpi/ic_launcher_round.png", 192]
];

for (const [relativePath, expectedSize] of legacyIcons) {
  if (!(await exists(relativePath))) {
    issues.push(`Ícone nativo ausente: ${relativePath}`);
    continue;
  }

  try {
    const buffer = await read(relativePath);
    const { width, height } = pngDimensions(buffer);
    checked.push({ file: relativePath, width, height });

    if (width !== expectedSize || height !== expectedSize) {
      issues.push(
        `Dimensão inesperada em ${relativePath}: ${width}x${height}; esperado ${expectedSize}x${expectedSize}`
      );
    }
  } catch (error) {
    issues.push(`Falha ao auditar ${relativePath}: ${error.message}`);
  }
}

for (const relativePath of [
  "mipmap-anydpi-v26/ic_launcher.xml",
  "mipmap-anydpi-v26/ic_launcher_round.xml"
]) {
  if (!(await exists(relativePath))) {
    issues.push(`Adaptive icon ausente: ${relativePath}`);
    continue;
  }

  const xml = await read(relativePath, "utf8");
  checked.push({ file: relativePath, adaptive: true });

  if (!xml.includes("<adaptive-icon")) {
    issues.push(`${relativePath} não contém <adaptive-icon>.`);
  }

  if (!/<background\b/.test(xml)) {
    issues.push(`${relativePath} não declara <background>.`);
  }

  if (!/<foreground\b/.test(xml)) {
    issues.push(`${relativePath} não declara <foreground>.`);
  }
}

const foregroundCandidates = [
  "mipmap-mdpi/ic_launcher_foreground.png",
  "mipmap-hdpi/ic_launcher_foreground.png",
  "mipmap-xhdpi/ic_launcher_foreground.png",
  "mipmap-xxhdpi/ic_launcher_foreground.png",
  "mipmap-xxxhdpi/ic_launcher_foreground.png"
];

const foregroundFound = [];
for (const relativePath of foregroundCandidates) {
  if (await exists(relativePath)) {
    const buffer = await read(relativePath);
    const { width, height } = pngDimensions(buffer);
    foregroundFound.push({ file: relativePath, width, height });
  }
}

if (foregroundFound.length < 5) {
  issues.push(
    `Foreground adaptativo incompleto: ${foregroundFound.length}/5 densidades encontradas.`
  );
}
checked.push(...foregroundFound);

const report = {
  legacyIconsChecked: checked.filter(item => item.file?.endsWith(".png") && !item.file.includes("foreground")).length,
  adaptiveXmlChecked: checked.filter(item => item.adaptive).length,
  adaptiveForegroundChecked: foregroundFound.length,
  source: "assets/icon.svg",
  issues
};

console.log(JSON.stringify(report, null, 2));

if (issues.length) {
  process.exit(1);
}
