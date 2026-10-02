import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "www");

const entries = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "src",
  "jogos"
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  const target = path.join(output, entry);
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    await fs.cp(source, target, { recursive: true });
  } else {
    await fs.copyFile(source, target);
  }
}

console.log(
  JSON.stringify(
    {
      webDir: "www",
      copiedEntries: entries
    },
    null,
    2
  )
);
