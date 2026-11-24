#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const pluginRoot = path.resolve(skillRoot, "..", "..");
const referenceRoot = path.join(skillRoot, "references");
const verifySources = process.argv.includes("--verify-sources");
const errors = [];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function parseFrontmatter(file) {
  const content = read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    errors.push(`${path.relative(pluginRoot, file)} 缺少 YAML frontmatter。`);
    return { content, meta: {} };
  }
  const meta = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (field) meta[field[1]] = field[2].trim();
  }
  return { content, meta };
}

function validateLinks(file, content) {
  for (const match of content.matchAll(/\]\(([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(pluginRoot, file)} 的連結不存在：${match[1]}`);
    }
  }
}

const manifestPath = path.join(pluginRoot, "plugin.json");
try {
  const manifest = JSON.parse(read(manifestPath));
  if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
    errors.push("plugin.json 未使用 Agent Plugins 1.0 schema。");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.name ?? "")) {
    errors.push("plugin.json 的 name 必須是小寫 kebab-case。");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
    errors.push("plugin.json 的 version 必須是 SemVer。");
  }
} catch (error) {
  errors.push(`plugin.json 無法解析：${error.message}`);
}

const skillPath = path.join(skillRoot, "SKILL.md");
const skill = parseFrontmatter(skillPath);
if (skill.meta.name !== "large-exposure-reporting") {
  errors.push("SKILL.md 的 name 不正確。");
}
if (!skill.meta.description) errors.push("SKILL.md 缺少 description。");
validateLinks(skillPath, skill.content);

const expectedReferenceFiles = new Set([
  "external-regulation.md",
  "internal-procedure.md",
  "qa.md",
  "reporting-guide.md",
  "source-index.md",
  "system-operations.md"
]);
const actualReferenceFiles = new Set(
  fs.readdirSync(referenceRoot).filter((name) => name.endsWith(".md"))
);
for (const name of expectedReferenceFiles) {
  if (!actualReferenceFiles.has(name)) errors.push(`缺少參考文件：${name}`);
}
for (const name of actualReferenceFiles) {
  if (!expectedReferenceFiles.has(name)) errors.push(`未登錄的參考文件：${name}`);
}

for (const name of actualReferenceFiles) {
  const file = path.join(referenceRoot, name);
  const parsed = parseFrontmatter(file);
  validateLinks(file, parsed.content);
  if (name !== "source-index.md") {
    for (const key of ["source_id", "source_file", "source_sha256", "converted_on"]) {
      if (!parsed.meta[key]) errors.push(`${name} 缺少 ${key}。`);
    }
  }
}

const sourceIndexPath = path.join(referenceRoot, "source-index.md");
const sourceIndex = read(sourceIndexPath);
const registeredSources = new Map();
for (const line of sourceIndex.split("\n")) {
  const row = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \| `([^`]+)` \| `([a-f0-9]{64})` \|$/);
  if (!row) continue;
  registeredSources.set(row[1], {
    sourcePath: row[2],
    markdown: row[3],
    expectedHash: row[4]
  });
  if (!row[2].startsWith("知識庫文件/") || row[2].includes("..")) {
    errors.push(`${row[1]} 不在知識庫文件/ 目錄內。`);
  }
  if (!actualReferenceFiles.has(row[3])) {
    errors.push(`${row[1]} 對應的 Markdown 不存在：${row[3]}`);
  }
}

for (const name of actualReferenceFiles) {
  if (name === "source-index.md") continue;
  const parsed = parseFrontmatter(path.join(referenceRoot, name));
  const source = registeredSources.get(parsed.meta.source_id);
  if (!source) {
    errors.push(`${name} 的 source_id 未登錄於 source-index.md。`);
    continue;
  }
  if (source.markdown !== name) errors.push(`${name} 與來源索引對應不一致。`);
  if (source.expectedHash !== parsed.meta.source_sha256) {
    errors.push(`${name} 的 SHA-256 與來源索引不一致。`);
  }
}

if (verifySources) {
  const workspaceRoot = path.resolve(pluginRoot, "..");
  const sourceRoot = path.join(workspaceRoot, "知識庫文件");
  if (!fs.existsSync(sourceRoot)) {
    errors.push("找不到知識庫文件/ 目錄。");
  } else {
    const actualSources = new Set(
      fs.readdirSync(sourceRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && !entry.name.startsWith("~$"))
        .map((entry) => `知識庫文件/${entry.name}`)
    );
    const indexedSources = new Set([...registeredSources.values()].map((item) => item.sourcePath));
    for (const sourcePath of actualSources) {
      if (!indexedSources.has(sourcePath)) errors.push(`來源索引遺漏：${sourcePath}`);
    }
    for (const sourcePath of indexedSources) {
      if (!actualSources.has(sourcePath)) errors.push(`來源檔案不存在：${sourcePath}`);
    }
    for (const [sourceId, source] of registeredSources) {
      const absolutePath = path.join(workspaceRoot, source.sourcePath);
      if (!fs.existsSync(absolutePath)) continue;
      const hash = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
      if (hash !== source.expectedHash) errors.push(`${sourceId} 的 SHA-256 不一致。`);
    }
  }
}

console.log(`Plugin：${path.basename(pluginRoot)}`);
console.log(`來源文件：${registeredSources.size}`);
console.log(`Markdown 參考文件：${actualReferenceFiles.size}`);
console.log(`來源檔案驗證：${verifySources ? "enabled" : "disabled"}`);

for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length > 0) {
  console.error(`驗證失敗：${errors.length} 個錯誤。`);
  process.exit(1);
}
console.log("驗證通過：0 個錯誤。");
