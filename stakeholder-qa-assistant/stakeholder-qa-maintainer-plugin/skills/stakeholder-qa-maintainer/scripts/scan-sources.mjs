#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const CURRENT_PLUGIN = "stakeholder-qa-assistant-plugin";
const SOURCE_SNAPSHOT = "sources";
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".xls", ".xlsx"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`無法辨識的參數：${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`參數 --${key} 缺少值。`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`找不到${label}：${directory}`);
  }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listSourceFiles(directory, label) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("~$"));
  const nestedDirectories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (nestedDirectories.length > 0) {
    throw new Error(`${label}不得包含子目錄：${nestedDirectories.join("、")}`);
  }
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-Hant"));
  if (files.length === 0) throw new Error(`${label}不可為空：${directory}`);
  const unsupported = files.filter((name) => !SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()));
  if (unsupported.length > 0) {
    throw new Error(`${label}含不支援格式：${unsupported.join("、")}`);
  }
  return files;
}

function parseSourceIndex(file) {
  const content = fs.readFileSync(file, "utf8");
  const active = new Map();
  const retired = new Map();
  let section = "";
  for (const line of content.split("\n")) {
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
      if (row) active.set(row[1], { sourceId: row[1], sourcePath: row[2], markdown: row[3], hash: row[4] });
    }
    if (section === "retired") {
      const row = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \| `(\d{4}-\d{2}-\d{2})` \| (.*?) \|$/);
      if (row) retired.set(row[1], { sourceId: row[1], sourcePath: row[2], retiredOn: row[3], note: row[4].trim() });
    }
  }
  if (active.size === 0) throw new Error("source-index.md 沒有有效來源，或尚未使用動態來源索引格式。");
  return { active, retired };
}

function parseSemver(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`版本不是有效 SemVer：${version}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function suggestVersion(version, structural) {
  const parsed = parseSemver(version);
  if (structural) return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function normalizeName(name) {
  return path.basename(name, path.extname(name))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_()（）\[\]【】,，.。\-]+/g, "");
}

function bigrams(value) {
  if (value.length < 2) return new Set([value]);
  const result = new Set();
  for (let index = 0; index < value.length - 1; index += 1) result.add(value.slice(index, index + 2));
  return result;
}

function similarity(left, right) {
  const leftSet = bigrams(normalizeName(left));
  const rightSet = bigrams(normalizeName(right));
  let intersection = 0;
  for (const value of leftSet) if (rightSet.has(value)) intersection += 1;
  return leftSet.size + rightSet.size === 0 ? 0 : (2 * intersection) / (leftSet.size + rightSet.size);
}

const args = parseArgs(process.argv.slice(2));
const workspace = path.resolve(args.workspace ?? process.cwd());
const pluginRoot = path.join(workspace, CURRENT_PLUGIN);
const sourceSnapshotRoot = path.join(workspace, SOURCE_SNAPSHOT);
const sourceIndexPath = path.join(
  pluginRoot,
  "skills",
  "stakeholder-qa-assistant",
  "references",
  "source-index.md"
);

assertDirectory(workspace, "工作目錄");
assertDirectory(pluginRoot, "現行 Plugin 目錄");
assertDirectory(sourceSnapshotRoot, "來源快照目錄");
if (!fs.existsSync(sourceIndexPath)) throw new Error(`找不到來源索引：${sourceIndexPath}`);

const validatorPath = path.join(pluginRoot, "skills", "stakeholder-qa-assistant", "scripts", "validate-plugin.mjs");
if (!fs.existsSync(validatorPath)) throw new Error(`找不到現行 Plugin validator：${validatorPath}`);
const baselineValidation = spawnSync(process.execPath, [validatorPath], {
  cwd: pluginRoot,
  encoding: "utf8"
});
if (baselineValidation.status !== 0) {
  throw new Error(`現行 Plugin 驗證失敗，不能比對來源快照。\n${baselineValidation.stdout}${baselineValidation.stderr}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
if (manifest.name !== "stakeholder-qa-assistant") throw new Error("現行 Plugin 名稱不是 stakeholder-qa-assistant。");
parseSemver(manifest.version);

const sourceIndex = parseSourceIndex(sourceIndexPath);
const incomingFiles = listSourceFiles(sourceSnapshotRoot, "來源快照");
const activeByFile = new Map();
for (const source of sourceIndex.active.values()) {
  const name = path.basename(source.sourcePath);
  if (activeByFile.has(name)) throw new Error(`source-index.md 的有效來源檔名重複：${name}`);
  activeByFile.set(name, source);
}

const currentItems = new Map();
for (const [name, source] of activeByFile) {
  currentItems.set(name, { ...source, file: name });
}
const incomingItems = new Map(
  incomingFiles.map((name) => [name, { file: name, hash: sha256File(path.join(sourceSnapshotRoot, name)) }])
);

const unchanged = [];
const changed = [];
const unmatchedCurrent = new Map(currentItems);
const unmatchedIncoming = new Map(incomingItems);

for (const [name, current] of currentItems) {
  const incoming = incomingItems.get(name);
  if (!incoming) continue;
  const item = {
    sourceId: current.sourceId,
    currentFile: name,
    incomingFile: name,
    markdown: current.markdown,
    currentHash: current.hash,
    incomingHash: incoming.hash
  };
  if (current.hash === incoming.hash) unchanged.push(item);
  else changed.push(item);
  unmatchedCurrent.delete(name);
  unmatchedIncoming.delete(name);
}

const currentByHash = new Map();
for (const item of unmatchedCurrent.values()) {
  const values = currentByHash.get(item.hash) ?? [];
  values.push(item);
  currentByHash.set(item.hash, values);
}
const incomingByHash = new Map();
for (const item of unmatchedIncoming.values()) {
  const values = incomingByHash.get(item.hash) ?? [];
  values.push(item);
  incomingByHash.set(item.hash, values);
}

const renamed = [];
for (const [hash, currentMatches] of currentByHash) {
  const incomingMatches = incomingByHash.get(hash) ?? [];
  if (currentMatches.length !== 1 || incomingMatches.length !== 1) continue;
  const current = currentMatches[0];
  const incoming = incomingMatches[0];
  renamed.push({
    sourceId: current.sourceId,
    currentFile: current.file,
    incomingFile: incoming.file,
    markdown: current.markdown,
    currentHash: hash,
    incomingHash: hash
  });
  unmatchedCurrent.delete(current.file);
  unmatchedIncoming.delete(incoming.file);
}

const removed = [...unmatchedCurrent.values()].map((item) => ({
  sourceId: item.sourceId,
  currentFile: item.file,
  markdown: item.markdown,
  currentHash: item.hash
}));
const added = [...unmatchedIncoming.values()].map((item) => ({
  incomingFile: item.file,
  incomingHash: item.hash
}));

const suggestions = [];
for (const removal of removed) {
  const candidates = added
    .filter((addition) => path.extname(addition.incomingFile).toLowerCase() === path.extname(removal.currentFile).toLowerCase())
    .map((addition) => ({
      sourceId: removal.sourceId,
      currentFile: removal.currentFile,
      incomingFile: addition.incomingFile,
      markdown: removal.markdown,
      score: Number(similarity(removal.currentFile, addition.incomingFile).toFixed(3))
    }))
    .filter((item) => item.score >= 0.35)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  suggestions.push(...candidates);
}

const hasChanges = changed.length + renamed.length + removed.length + added.length > 0;
const structural = added.length > 0 || removed.length > 0;
const result = {
  schemaVersion: "stakeholder-qa-source-scan.v2",
  workspace,
  currentVersion: manifest.version,
  paths: {
    currentPlugin: pluginRoot,
    sourceSnapshot: sourceSnapshotRoot
  },
  counts: {
    active: sourceIndex.active.size,
    retired: sourceIndex.retired.size,
    incoming: incomingFiles.length,
    unchanged: unchanged.length,
    changed: changed.length,
    renamed: renamed.length,
    added: added.length,
    removed: removed.length
  },
  hasChanges,
  requiresConfirmation: hasChanges,
  suggestedVersion: hasChanges ? suggestVersion(manifest.version, structural) : null,
  versionReason: !hasChanges
    ? "來源快照完全相同"
    : structural
      ? "來源集合新增或移除，試行期建議增加 Minor"
      : "既有來源換版或更名，且未偵測到來源集合變更，建議增加 Patch",
  changes: { unchanged, changed, renamed, added, removed },
  possibleReplacements: suggestions,
  warnings: suggestions.length > 0
    ? ["可能存在更名且內容異動的文件；建議對應只供人工確認，不會自動套用。"]
    : []
};

const output = `${JSON.stringify(result, null, 2)}\n`;
if (args.output) {
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
}
process.stdout.write(output);
