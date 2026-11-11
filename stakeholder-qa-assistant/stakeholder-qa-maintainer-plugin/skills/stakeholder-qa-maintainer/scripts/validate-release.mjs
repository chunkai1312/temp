#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const OUTPUT_ROOT = "releases";
const SOURCE_SNAPSHOT = "sources";
const PLUGIN_DIRECTORY = "stakeholder-qa-assistant-plugin";
const CONVERSION_MARKER = "<!-- STAKEHOLDER_QA_CONVERSION_REQUIRED -->";
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

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseFrontmatter(file, errors, displayRoot) {
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    errors.push(`${path.relative(displayRoot, file)} 缺少 YAML frontmatter。`);
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

function parseSourceIndex(file, errors, displayRoot) {
  const parsed = parseFrontmatter(file, errors, displayRoot);
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
      active.set(row[1], { sourceId: row[1], sourcePath: row[2], markdown: row[3], hash: row[4] });
    }
    if (section === "retired") {
      const row = line.match(/^\| `(SRC-\d{3})` \| `([^`]+)` \| `(\d{4}-\d{2}-\d{2})` \| (.*?) \|$/);
      if (!row) continue;
      if (retired.has(row[1])) errors.push(`已停用來源 ID 重複：${row[1]}`);
      retired.set(row[1], { sourceId: row[1], sourcePath: row[2], retiredOn: row[3], note: row[4].trim() });
    }
  }
  return { ...parsed, active, retired };
}

function listFilesRecursive(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  visit(root);
  return result.sort((left, right) => left.localeCompare(right));
}

function validateMarkdownLinks(file, errors, displayRoot) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(/\]\(([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) errors.push(`${path.relative(displayRoot, file)} 的連結不存在：${match[1]}`);
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let number = 0; number < 256; number += 1) {
    let value = number;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[number] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createStoredZip(sourceRoot, zipPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const rootName = path.basename(sourceRoot);
  const files = listFilesRecursive(sourceRoot);

  for (const file of files) {
    const data = fs.readFileSync(file);
    const relative = path.relative(sourceRoot, file).split(path.sep).join("/");
    const entryName = `${rootName}/${relative}`;
    const name = Buffer.from(entryName, "utf8");
    const checksum = crc32(data);
    const stats = fs.statSync(file);
    const { dosTime, dosDate } = dosDateTime(stats.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  fs.writeFileSync(zipPath, Buffer.concat([...localParts, centralDirectory, end]));
}

const args = parseArgs(process.argv.slice(2));
if (!args.candidate) throw new Error("必須提供 --candidate <候選 Plugin 目錄>。");
const workspace = path.resolve(args.workspace ?? process.cwd());
const candidateRoot = path.resolve(args.candidate);
const expectedOutputRoot = path.join(workspace, OUTPUT_ROOT);
const relativeCandidate = path.relative(expectedOutputRoot, candidateRoot);
if (relativeCandidate.startsWith("..") || path.isAbsolute(relativeCandidate)) {
  throw new Error("候選 Plugin 必須位於工作目錄的 releases/ 之下。");
}
if (path.basename(candidateRoot) !== PLUGIN_DIRECTORY) {
  throw new Error(`候選 Plugin 目錄名稱必須是 ${PLUGIN_DIRECTORY}。`);
}
if (!fs.existsSync(candidateRoot) || !fs.statSync(candidateRoot).isDirectory()) {
  throw new Error(`找不到候選 Plugin：${candidateRoot}`);
}
const sourceSnapshotRoot = path.join(workspace, SOURCE_SNAPSHOT);
if (!fs.existsSync(sourceSnapshotRoot) || !fs.statSync(sourceSnapshotRoot).isDirectory()) {
  throw new Error(`找不到來源快照：${sourceSnapshotRoot}`);
}

const releaseRoot = path.dirname(candidateRoot);
const errors = [];
const warnings = [];
const manifestPath = path.join(candidateRoot, "plugin.json");
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  errors.push(`plugin.json 無法解析：${error.message}`);
}
if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") errors.push("plugin.json schema 不正確。");
if (manifest.name !== "stakeholder-qa-assistant") errors.push("plugin.json name 不正確。");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) errors.push("plugin.json version 不是 SemVer。");
if (manifest.author?.name !== "永豐金控法令遵循處") errors.push("plugin.json author.name 不正確。");
if (manifest.license !== "UNLICENSED") errors.push("plugin.json license 不正確。");

const skillRoot = path.join(candidateRoot, "skills", "stakeholder-qa-assistant");
const skillPath = path.join(skillRoot, "SKILL.md");
const referenceRoot = path.join(skillRoot, "references");
const sourceIndexPath = path.join(referenceRoot, "source-index.md");
for (const required of [skillPath, referenceRoot, sourceIndexPath]) {
  if (!fs.existsSync(required)) errors.push(`候選 Plugin 缺少：${path.relative(candidateRoot, required)}`);
}

let skill = { content: "", frontmatter: "", meta: {} };
let sourceIndex = { active: new Map(), retired: new Map(), meta: {} };
if (fs.existsSync(skillPath)) {
  skill = parseFrontmatter(skillPath, errors, candidateRoot);
  const skillVersion = parseSkillMetadataVersion(skill.frontmatter);
  if (skill.meta.name !== "stakeholder-qa-assistant") errors.push("SKILL.md name 不正確。");
  if (!skillVersion) errors.push("SKILL.md 缺少 metadata.version。");
  if (manifest.version && skillVersion && manifest.version !== skillVersion) {
    errors.push(`Plugin 與 Skill 版本不一致：${manifest.version} / ${skillVersion}`);
  }
  if (skill.content.includes(CONVERSION_MARKER)) errors.push("SKILL.md 含未完成轉換標記。");
  validateMarkdownLinks(skillPath, errors, candidateRoot);
}
if (fs.existsSync(sourceIndexPath)) sourceIndex = parseSourceIndex(sourceIndexPath, errors, candidateRoot);
if (sourceIndex.active.size === 0) errors.push("source-index.md 沒有有效來源。");
for (const sourceId of sourceIndex.active.keys()) {
  if (sourceIndex.retired.has(sourceId)) errors.push(`來源 ID 同時為有效與停用：${sourceId}`);
}

const referenceFiles = fs.existsSync(referenceRoot)
  ? fs.readdirSync(referenceRoot).filter((name) => name.endsWith(".md"))
  : [];
const actualReferences = new Set(referenceFiles);
const expectedReferences = new Set(["source-index.md", ...[...sourceIndex.active.values()].map((source) => source.markdown)]);
for (const name of expectedReferences) if (!actualReferences.has(name)) errors.push(`缺少 reference：${name}`);
for (const name of actualReferences) if (!expectedReferences.has(name)) errors.push(`未登錄或已停用的 reference：${name}`);

for (const [sourceId, source] of sourceIndex.active) {
  if (!skill.content.includes(`](references/${source.markdown})`)) errors.push(`${source.markdown} 未出現在 SKILL.md 的問題路由或來源連結中。`);
  const referencePath = path.join(referenceRoot, source.markdown);
  if (!fs.existsSync(referencePath)) continue;
  const reference = parseFrontmatter(referencePath, errors, candidateRoot);
  if (reference.content.includes(CONVERSION_MARKER)) errors.push(`${source.markdown} 尚未完成原始文件轉換。`);
  if (reference.meta.source_id !== sourceId) errors.push(`${source.markdown} 的 source_id 不一致。`);
  if (reference.meta.source_file !== source.sourcePath) errors.push(`${source.markdown} 的 source_file 不一致。`);
  if (reference.meta.source_sha256 !== source.hash) errors.push(`${source.markdown} 的 source_sha256 不一致。`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reference.meta.converted_on ?? "")) errors.push(`${source.markdown} 的 converted_on 不正確。`);
  validateMarkdownLinks(referencePath, errors, candidateRoot);
}

const snapshotEntries = fs.readdirSync(sourceSnapshotRoot, { withFileTypes: true })
  .filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("~$"));
const snapshotDirectories = snapshotEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (snapshotDirectories.length > 0) errors.push(`來源快照不得包含子目錄：${snapshotDirectories.join("、")}`);
const snapshotFiles = snapshotEntries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
const unsupportedSnapshotFiles = snapshotFiles.filter((name) => !SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()));
if (unsupportedSnapshotFiles.length > 0) {
  errors.push(`來源快照含不支援格式：${unsupportedSnapshotFiles.join("、")}`);
}
const indexedSnapshotFiles = new Set([...sourceIndex.active.values()].map((source) => path.basename(source.sourcePath)));
for (const name of snapshotFiles) if (!indexedSnapshotFiles.has(name)) errors.push(`來源快照未登錄：${name}`);
for (const name of indexedSnapshotFiles) if (!snapshotFiles.includes(name)) errors.push(`有效來源不在來源快照：${name}`);
for (const [sourceId, source] of sourceIndex.active) {
  const sourceFile = path.join(sourceSnapshotRoot, path.basename(source.sourcePath));
  if (fs.existsSync(sourceFile) && sha256File(sourceFile) !== source.hash) errors.push(`${sourceId} 的來源 SHA-256 不一致。`);
}

for (const file of listFilesRecursive(candidateRoot)) {
  const extension = path.extname(file).toLowerCase();
  if ([".pdf", ".docx", ".xls", ".xlsx"].includes(extension)) {
    errors.push(`候選 Plugin 不得包含原始文件：${path.relative(candidateRoot, file)}`);
  }
}

const validatorPath = path.join(skillRoot, "scripts", "validate-plugin.mjs");
let candidateValidator = { status: null, stdout: "", stderr: "" };
if (!fs.existsSync(validatorPath)) {
  errors.push("候選 Plugin 缺少 validate-plugin.mjs。");
} else {
  const result = spawnSync(process.execPath, [validatorPath], { cwd: candidateRoot, encoding: "utf8" });
  candidateValidator = { status: result.status, stdout: result.stdout, stderr: result.stderr };
  if (result.status !== 0) errors.push("候選 Plugin 內建 validator 驗證失敗。");
}

const zipPath = path.join(releaseRoot, `${PLUGIN_DIRECTORY}-${manifest.version ?? "invalid"}.zip`);
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
const validationResultPath = path.join(releaseRoot, "validation-result.json");
const validation = {
  schemaVersion: "stakeholder-qa-release-validation.v1",
  candidateRoot,
  sourceSnapshotRoot,
  version: manifest.version ?? null,
  activeSources: sourceIndex.active.size,
  retiredSources: sourceIndex.retired.size,
  referenceFiles: referenceFiles.length,
  status: errors.length === 0 ? "pass" : "fail",
  errors,
  warnings,
  candidateValidator
};

if (errors.length === 0) {
  createStoredZip(candidateRoot, zipPath);
  validation.zipPath = zipPath;
  validation.zipSha256 = sha256File(zipPath);
  validation.zipBytes = fs.statSync(zipPath).size;
}
fs.writeFileSync(validationResultPath, `${JSON.stringify(validation, null, 2)}\n`);

process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
if (errors.length > 0) process.exit(1);
