#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const pluginRoot = path.resolve(skillRoot, "..", "..");
const releaseMode = process.argv.includes("--release");
const verifySources = process.argv.includes("--verify-sources");
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function listFiles(dir, suffix) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(target, suffix);
    return entry.name.endsWith(suffix) ? [target] : [];
  });
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

function validateRelativeLinks(file, content) {
  const linkPattern = /\]\(([^)]+\.md)(?:#[^)]+)?\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const link = match[1];
    if (/^(?:https?:|\/)/.test(link)) continue;
    const target = path.resolve(path.dirname(file), link);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(pluginRoot, file)} 的連結不存在：${link}`);
    }
  }
}

const manifestPath = path.join(pluginRoot, "plugin.json");
if (!fs.existsSync(manifestPath)) {
  errors.push("缺少根目錄 plugin.json。");
} else {
  try {
    const manifest = JSON.parse(read(manifestPath));
    if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
      errors.push("plugin.json 必須使用 Agent Plugins 1.0 schema。");
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.name ?? "")) {
      errors.push("plugin.json 的 name 必須是小寫 kebab-case。");
    }
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
      errors.push("plugin.json 的 version 必須是 SemVer。");
    }
    if ("skills" in manifest || "mcpServers" in manifest) {
      errors.push("Agent Plugins 1.0 不應在 manifest 宣告 skills 或 mcpServers 路徑。");
    }
  } catch (error) {
    errors.push(`plugin.json 無法解析：${error.message}`);
  }
}

const skillPath = path.join(skillRoot, "SKILL.md");
const skill = parseFrontmatter(skillPath);
if (skill.meta.name !== "large-exposure-reporting") {
  errors.push("SKILL.md 的 name 必須是 large-exposure-reporting。");
}
if (!skill.meta.description) errors.push("SKILL.md 缺少 description。");
validateRelativeLinks(skillPath, skill.content);

const referenceRoot = path.join(skillRoot, "references");
const referenceFiles = listFiles(referenceRoot, ".md");
const referenceIds = new Map();

for (const file of referenceFiles) {
  const { content, meta } = parseFrontmatter(file);
  const relative = path.relative(pluginRoot, file);
  for (const required of ["id", "title", "status", "owner", "last_reviewed"]) {
    if (!meta[required]) errors.push(`${relative} 缺少 ${required}。`);
  }
  if (meta.id) {
    if (referenceIds.has(meta.id)) {
      errors.push(`重複的知識 ID：${meta.id}。`);
    } else {
      referenceIds.set(meta.id, relative);
    }
  }
  if (meta.status !== "approved") {
    const message = `${relative} 的狀態是 ${meta.status || "未設定"}。`;
    if (releaseMode) errors.push(message);
    else warnings.push(message);
  }
  if (/\/Users\/|[A-Za-z]:\\\\|~\//.test(content)) {
    errors.push(`${relative} 含有不可攜的絕對路徑。`);
  }
  validateRelativeLinks(file, content);
}

const sourceIndex = read(path.join(referenceRoot, "sources", "source-index.md"));
const allReferenceText = referenceFiles.map(read).join("\n");
const registeredSources = new Map();
for (const line of sourceIndex.split("\n")) {
  const sourceRow = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \|.*\| `([a-f0-9]{64})` \|$/);
  if (!sourceRow) continue;
  registeredSources.set(sourceRow[1], {
    sourcePath: sourceRow[2],
    expectedHash: sourceRow[3]
  });
  if (!sourceRow[2].startsWith("知識庫文件/") || sourceRow[2].includes("..")) {
    errors.push(`來源 ${sourceRow[1]} 不在知識庫文件/ 目錄內：${sourceRow[2]}`);
  }
}

for (const sourceId of new Set(allReferenceText.match(/SRC-\d{3}/g) ?? [])) {
  if (!registeredSources.has(sourceId)) {
    errors.push(`來源 ${sourceId} 未登錄於 source-index.md。`);
  }
}

if (verifySources) {
  const workspaceRoot = path.resolve(pluginRoot, "..");
  const sourceRoot = path.join(workspaceRoot, "知識庫文件");
  if (!fs.existsSync(sourceRoot)) {
    errors.push("找不到原始知識庫文件/ 目錄，無法驗證來源檔案。");
  } else {
    const actualSourcePaths = new Set(
      fs.readdirSync(sourceRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && !entry.name.startsWith("~$"))
        .map((entry) => `知識庫文件/${entry.name}`)
    );
    const indexedSourcePaths = new Set(
      [...registeredSources.values()].map((source) => source.sourcePath)
    );

    for (const sourcePath of actualSourcePaths) {
      if (!indexedSourcePaths.has(sourcePath)) errors.push(`來源索引遺漏：${sourcePath}`);
    }
    for (const sourcePath of indexedSourcePaths) {
      if (!actualSourcePaths.has(sourcePath)) errors.push(`來源檔案不存在：${sourcePath}`);
    }

    for (const [sourceId, source] of registeredSources) {
      const absoluteSourcePath = path.join(workspaceRoot, source.sourcePath);
      if (!fs.existsSync(absoluteSourcePath)) continue;
      const actualHash = crypto.createHash("sha256")
        .update(fs.readFileSync(absoluteSourcePath))
        .digest("hex");
      if (actualHash !== source.expectedHash) {
        errors.push(`${sourceId} 的 SHA-256 與來源索引不一致。`);
      }
    }
  }
}

const testsPath = path.join(pluginRoot, "tests", "regression-cases.json");
try {
  const suite = JSON.parse(read(testsPath));
  if (suite.source_scope !== "知識庫文件/") {
    errors.push("迴歸案例的 source_scope 必須是知識庫文件/。");
  }
  const cases = suite.cases ?? [];
  if (cases.length < 20) errors.push("迴歸案例至少需要 20 題，涵蓋四類常見情境的同義問法。");
  const ids = new Set();
  const groups = new Map();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) errors.push(`重複的測試 ID：${testCase.id}。`);
    ids.add(testCase.id);
    groups.set(testCase.group, (groups.get(testCase.group) ?? 0) + 1);
    if (!testCase.question || !(testCase.expected_facts?.length > 0)) {
      errors.push(`${testCase.id} 缺少 question 或 expected_facts。`);
    }
    for (const referenceId of testCase.expected_reference_ids ?? []) {
      if (!referenceIds.has(referenceId)) {
        errors.push(`${testCase.id} 引用了不存在的知識 ID：${referenceId}。`);
      }
    }
  }
  for (const group of [
    "scope-and-threshold",
    "f19-highest-balance",
    "f19-fields",
    "internal-external-threshold"
  ]) {
    if ((groups.get(group) ?? 0) < 5) errors.push(`${group} 至少需要 5 個同義問法。`);
  }
} catch (error) {
  errors.push(`tests/regression-cases.json 無法解析：${error.message}`);
}

console.log(`Plugin：${path.basename(pluginRoot)}`);
console.log(`知識文件：${referenceFiles.length}`);
console.log(`驗證模式：${releaseMode ? "release" : "development"}`);
console.log(`來源檔案驗證：${verifySources ? "enabled" : "disabled"}`);

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);

if (errors.length > 0) {
  console.error(`驗證失敗：${errors.length} 個錯誤，${warnings.length} 個警告。`);
  process.exit(1);
}

console.log(`驗證通過：0 個錯誤，${warnings.length} 個警告。`);
