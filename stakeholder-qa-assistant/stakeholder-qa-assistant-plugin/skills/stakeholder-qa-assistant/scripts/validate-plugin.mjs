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
    return { content, frontmatter: "", meta: {} };
  }
  const meta = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (field) meta[field[1]] = field[2].trim().replace(/^"|"$/g, "");
  }
  return { content, frontmatter: match[1], meta };
}

function parseSkillMetadataVersion(frontmatter) {
  const match = frontmatter.match(/(?:^|\n)metadata:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+version:\s*["']?([^"'\n]+)["']?/);
  return match?.[1]?.trim() ?? "";
}

function validateLinks(file, content) {
  for (const match of content.matchAll(/\]\(([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(pluginRoot, file)} 的連結不存在：${match[1]}`);
    }
  }
}

function parseSourceIndex(file) {
  const parsed = parseFrontmatter(file);
  const active = new Map();
  const retired = new Map();
  let section = "";

  for (const line of parsed.content.split("\n")) {
    if (line.trim() === "## 有效來源") {
      section = "active";
      continue;
    }
    if (line.trim() === "## 已停用來源") {
      section = "retired";
      continue;
    }

    if (section === "active") {
      const row = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \| `([^`]+)` \| `([a-f0-9]{64})` \|$/);
      if (!row) continue;
      if (active.has(row[1])) errors.push(`有效來源 ID 重複：${row[1]}`);
      active.set(row[1], {
        sourcePath: row[2],
        markdown: row[3],
        expectedHash: row[4]
      });
    }

    if (section === "retired") {
      const row = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \| `(\d{4}-\d{2}-\d{2})` \| (.*?) \|$/);
      if (!row) continue;
      if (retired.has(row[1])) errors.push(`已停用來源 ID 重複：${row[1]}`);
      retired.set(row[1], {
        sourcePath: row[2],
        retiredOn: row[3],
        note: row[4].trim()
      });
    }
  }

  return { ...parsed, active, retired };
}

const manifestPath = path.join(pluginRoot, "plugin.json");
let manifest = {};
try {
  manifest = JSON.parse(read(manifestPath));
  const allowedFields = new Set([
    "$schema", "name", "version", "description", "author", "homepage",
    "repository", "license", "keywords", "extensions"
  ]);
  if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
    errors.push("plugin.json 未使用 Agent Plugins 1.0.0 schema。");
  }
  if (manifest.name !== "stakeholder-qa-assistant") {
    errors.push("plugin.json 的 name 不正確。");
  }
  if (!/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(manifest.name ?? "")) {
    errors.push("plugin.json 的 name 不符合 Agent Plugins 命名規則。");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
    errors.push("plugin.json 的 version 必須是 SemVer。");
  }
  if (manifest.author?.name !== "永豐金控法令遵循處") {
    errors.push("plugin.json 的 author.name 不正確。");
  }
  for (const key of Object.keys(manifest)) {
    if (!allowedFields.has(key)) errors.push(`plugin.json 含未允許欄位：${key}`);
  }
} catch (error) {
  errors.push(`plugin.json 無法解析：${error.message}`);
}

const skillPath = path.join(skillRoot, "SKILL.md");
const skill = parseFrontmatter(skillPath);
if (skill.meta.name !== "stakeholder-qa-assistant") {
  errors.push("SKILL.md 的 name 不正確。");
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.meta.name ?? "")) {
  errors.push("SKILL.md 的 name 不符合 Agent Skills 命名規則。");
}
if (!skill.meta.description) errors.push("SKILL.md 缺少 description。");
const skillVersion = parseSkillMetadataVersion(skill.frontmatter);
if (!skillVersion) errors.push("SKILL.md 缺少 metadata.version。");
if (manifest.version && skillVersion && manifest.version !== skillVersion) {
  errors.push(`Plugin 與 Skill 版本不一致：${manifest.version} / ${skillVersion}`);
}
validateLinks(skillPath, skill.content);

const sourceIndexPath = path.join(referenceRoot, "source-index.md");
const sourceIndex = parseSourceIndex(sourceIndexPath);
const sourceScope = sourceIndex.meta.source_scope ?? "";
if (!sourceScope || path.isAbsolute(sourceScope) || sourceScope.includes("..")) {
  errors.push("source-index.md 的 source_scope 不正確。");
}
if (sourceIndex.active.size === 0) errors.push("source-index.md 沒有有效來源。");

for (const sourceId of sourceIndex.active.keys()) {
  if (sourceIndex.retired.has(sourceId)) errors.push(`來源 ID 同時為有效與停用：${sourceId}`);
}

const actualReferenceFiles = new Set(
  fs.readdirSync(referenceRoot).filter((name) => name.endsWith(".md"))
);
const expectedReferenceFiles = new Set([
  "source-index.md",
  ...[...sourceIndex.active.values()].map((source) => source.markdown)
]);
for (const name of expectedReferenceFiles) {
  if (!actualReferenceFiles.has(name)) errors.push(`缺少參考文件：${name}`);
}
for (const name of actualReferenceFiles) {
  if (!expectedReferenceFiles.has(name)) errors.push(`未登錄的參考文件：${name}`);
}

for (const [sourceId, source] of sourceIndex.active) {
  if (!source.sourcePath.startsWith(sourceScope) || source.sourcePath.includes("..")) {
    errors.push(`${sourceId} 不在 source_scope 目錄內。`);
  }
  if (!actualReferenceFiles.has(source.markdown)) {
    errors.push(`${sourceId} 對應的 Markdown 不存在：${source.markdown}`);
  }
  if (!skill.content.includes(`](references/${source.markdown})`)) {
    errors.push(`${source.markdown} 未出現在 SKILL.md 的問題路由或來源連結中。`);
  }
}

for (const [sourceId, source] of sourceIndex.retired) {
  if (!source.sourcePath.startsWith(sourceScope) || source.sourcePath.includes("..")) {
    errors.push(`已停用來源 ${sourceId} 不在 source_scope 目錄內。`);
  }
}

for (const name of actualReferenceFiles) {
  const file = path.join(referenceRoot, name);
  const parsed = parseFrontmatter(file);
  validateLinks(file, parsed.content);
  if (name === "source-index.md") continue;

  for (const key of ["source_id", "source_file", "source_sha256", "converted_on"]) {
    if (!parsed.meta[key]) errors.push(`${name} 缺少 ${key}。`);
  }
  if (parsed.meta.converted_on && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.meta.converted_on)) {
    errors.push(`${name} 的 converted_on 格式不正確。`);
  }
  const source = sourceIndex.active.get(parsed.meta.source_id);
  if (!source) {
    errors.push(`${name} 的 source_id 未登錄於有效來源。`);
    continue;
  }
  if (source.markdown !== name) errors.push(`${name} 與來源索引對應不一致。`);
  if (source.sourcePath !== parsed.meta.source_file) {
    errors.push(`${name} 的 source_file 與來源索引不一致。`);
  }
  if (source.expectedHash !== parsed.meta.source_sha256) {
    errors.push(`${name} 的 SHA-256 與來源索引不一致。`);
  }
}

if (verifySources) {
  const workspaceRoot = path.resolve(pluginRoot, "..");
  const sourceRoot = path.join(workspaceRoot, sourceScope.replace(/\/$/, ""));
  if (!fs.existsSync(sourceRoot)) {
    errors.push(`找不到來源目錄：${sourceScope}`);
  } else {
    const sourceEntries = fs.readdirSync(sourceRoot, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("~$"));
    const nestedDirectories = sourceEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (nestedDirectories.length > 0) {
      errors.push(`來源目錄不得包含子目錄：${nestedDirectories.join("、")}`);
    }
    const actualSources = new Set(
      sourceEntries
        .filter((entry) => entry.isFile())
        .map((entry) => `${sourceScope}${entry.name}`)
    );
    const indexedSources = new Set([...sourceIndex.active.values()].map((item) => item.sourcePath));
    for (const sourcePath of actualSources) {
      if (!indexedSources.has(sourcePath)) errors.push(`來源索引遺漏：${sourcePath}`);
    }
    for (const sourcePath of indexedSources) {
      if (!actualSources.has(sourcePath)) errors.push(`來源檔案不存在：${sourcePath}`);
    }
    for (const [sourceId, source] of sourceIndex.active) {
      const absolutePath = path.join(workspaceRoot, source.sourcePath);
      if (!fs.existsSync(absolutePath)) continue;
      const hash = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
      if (hash !== source.expectedHash) errors.push(`${sourceId} 的 SHA-256 不一致。`);
    }
  }
}

console.log(`Plugin：${path.basename(pluginRoot)}`);
console.log(`有效來源：${sourceIndex.active.size}`);
console.log(`已停用來源：${sourceIndex.retired.size}`);
console.log(`Markdown 參考文件：${actualReferenceFiles.size}`);
console.log(`來源檔案驗證：${verifySources ? "enabled" : "disabled"}`);

for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length > 0) {
  console.error(`驗證失敗：${errors.length} 個錯誤。`);
  process.exit(1);
}
console.log("驗證通過：0 個錯誤。");
