import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const gradlePath = path.join(root, "android", "app", "build.gradle");

const requiredEnv = [
  "ANDROID_KEYSTORE_FILE",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD"
];

const missing = requiredEnv.filter(name => !process.env[name]);

if (missing.length) {
  console.error(
    `Variáveis obrigatórias ausentes para assinatura release: ${missing.join(", ")}`
  );
  process.exit(1);
}

const versionCode = String(process.env.ANDROID_VERSION_CODE || "1");
const versionName = String(process.env.ANDROID_VERSION_NAME || "0.1.0");

if (!/^\d+$/.test(versionCode) || Number(versionCode) < 1) {
  console.error(`ANDROID_VERSION_CODE inválido: ${versionCode}`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) {
  console.error(`ANDROID_VERSION_NAME inválido: ${versionName}`);
  process.exit(1);
}

let gradle = await fs.readFile(gradlePath, "utf8");

const codeMatch = gradle.match(/\bversionCode\s+(\d+)/);
const nameMatch = gradle.match(/\bversionName\s+"([^"]+)"/);

if (!codeMatch || !nameMatch) {
  console.error("Não foi possível localizar versionCode/versionName no build.gradle.");
  process.exit(1);
}

gradle = gradle.replace(
  /\bversionCode\s+\d+/,
  `versionCode ${versionCode}`
);
gradle = gradle.replace(
  /\bversionName\s+"[^"]+"/,
  `versionName "${versionName}"`
);

const signingMarker = "// livros-jogos: release signing via environment";

if (!gradle.includes(signingMarker)) {
  const buildTypesPattern = /(^\s*)buildTypes\s*\{/m;
  const buildTypesMatch = gradle.match(buildTypesPattern);

  if (!buildTypesMatch) {
    console.error("Bloco buildTypes não encontrado no build.gradle.");
    process.exit(1);
  }

  const indent = buildTypesMatch[1];
  const signingBlock = `${indent}${signingMarker}
${indent}signingConfigs {
${indent}    release {
${indent}        storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
${indent}        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
${indent}        keyAlias System.getenv("ANDROID_KEY_ALIAS")
${indent}        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
${indent}    }
${indent}}

`;

  gradle = gradle.replace(buildTypesPattern, signingBlock + buildTypesMatch[0]);
}

if (!/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(gradle)) {
  const releasePattern = /(buildTypes\s*\{[\s\S]*?release\s*\{)/;
  const releaseMatch = gradle.match(releasePattern);

  if (!releaseMatch) {
    console.error("Bloco release não encontrado em buildTypes.");
    process.exit(1);
  }

  gradle = gradle.replace(
    releasePattern,
    `${releaseMatch[1]}
            signingConfig signingConfigs.release`
  );
}

await fs.writeFile(gradlePath, gradle, "utf8");

console.log(JSON.stringify({
  gradle: path.relative(root, gradlePath),
  versionCode: Number(versionCode),
  versionName,
  signing: "environment",
  keystorePathConfigured: true,
  passwordsLogged: false
}, null, 2));
