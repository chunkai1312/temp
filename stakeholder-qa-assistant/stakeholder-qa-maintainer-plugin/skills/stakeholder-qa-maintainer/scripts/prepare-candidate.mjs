#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const CURRENT_PLUGIN = "stakeholder-qa-assistant-plugin";
const SOURCE_SNAPSHOT = "sources";
const OUTPUT_ROOT = "releases";
const PLAN_SCHEMA = "stakeholder-qa-update-plan.v1";
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

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`找不到${label}：${directory}`);
  }
}

function safeFileName(value, field) {
  if (typeof value !== "string" || !value || path.basename(value) !== value || value.includes("..")) {
    throw new Error(`${field} 必須是單一檔名，不得包含路徑：${value}`);
  }
  return value;
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseSemver(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`版本不是有效 SemVer：${version}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function nextVersion(currentVersion, plan, structural) {
  const current = parseSemver(currentVersion);
  if (plan.promoteToStable === true) {
    if (current.major !== 0) throw new Error("只有試行期 0.x 可以使用 promoteToStable。");
    return "1.0.0";
  }
  if (current.major === 0) {
    if (structural || plan.routeChanged === true) return `0.${current.minor + 1}.0`;
    return `0.${current.minor}.${current.patch + 1}`;
  }
  if (plan.breakingChange === true || plan.changes.some((change) => change.action === "remove")) {
    return `${current.major + 1}.0.0`;
  }
  if (structural || plan.routeChanged === true) return `${current.major}.${current.minor + 1}.0`;
  return `${current.major}.${current.minor}.${current.patch + 1}`;
}

function currentDateTaipei() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseSourceIndex(file) {
  const content = fs.readFileSync(file, "utf8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? "原始來源索引";
  const sourceScope = frontmatter.match(/^source_scope:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (!sourceScope || path.isAbsolute(sourceScope) || sourceScope.includes("..")) {
    throw new Error("source-index.md 的 source_scope 不正確。");
  }
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
  if (active.size === 0) throw new Error("source-index.md 沒有有效來源。");
  return { title, sourceScope, active, retired };
}

function renderSourceIndex(index, convertedOn) {
  const sortById = (left, right) => left.sourceId.localeCompare(right.sourceId);
  const activeRows = [...index.active.values()].sort(sortById).map((source) =>
    `| \`${source.sourceId}\` | \`${source.sourcePath}\` | \`${source.markdown}\` | \`${source.hash}\` |`
  );
  const retiredRows = [...index.retired.values()].sort(sortById).map((source) =>
    `| \`${source.sourceId}\` | \`${source.sourcePath}\` | \`${source.retiredOn}\` | ${source.note || "—"} |`
  );
  return [
    "---",
    `title: ${index.title}`,
    `converted_on: ${convertedOn}`,
    `source_scope: ${index.sourceScope}`,
    "---",
    "",
    "# 原始來源索引",
    "",
    "## 有效來源",
    "",
    "| 來源 ID | 原始檔案 | Markdown | SHA-256 |",
    "|---|---|---|---|",
    ...activeRows,
    "",
    "## 已停用來源",
    "",
    "| 來源 ID | 原始檔案 | 停用日期 | 說明 |",
    "|---|---|---|---|",
    ...retiredRows,
    "",
    "Markdown 是原始文件的結構化轉寫。回答時應標示來源 ID，並提供頁碼、條次、章節或問答題號等可定位資訊。",
    ""
  ].join("\n");
}

function updateFrontmatter(content, values) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error("reference 缺少 YAML frontmatter。");
  let frontmatter = match[1];
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}:.*$`, "m");
    if (!pattern.test(frontmatter)) throw new Error(`reference 缺少 ${key}。`);
    frontmatter = frontmatter.replace(pattern, `${key}: ${value}`);
  }
  return `---\n${frontmatter}\n---\n${content.slice(match[0].length)}`;
}

function renderPendingReference(source, convertedOn) {
  return [
    "---",
    `source_id: ${source.sourceId}`,
    `source_file: ${source.sourcePath}`,
    `source_sha256: ${source.hash}`,
    `converted_on: ${convertedOn}`,
    "---",
    "",
    CONVERSION_MARKER,
    "",
    "# 待重新轉換",
    "",
    "此檔案是候選版本的暫存標記。完成原始文件轉換後必須以正式內容取代，否則發布驗證會失敗。",
    ""
  ].join("\n");
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

const args = parseArgs(process.argv.slice(2));
if (!args.plan) throw new Error("必須提供 --plan <已確認計畫檔>。");
const workspace = path.resolve(args.workspace ?? process.cwd());
const planPath = path.resolve(args.plan);
const currentPluginRoot = path.join(workspace, CURRENT_PLUGIN);
const sourceSnapshotRoot = path.join(workspace, SOURCE_SNAPSHOT);

assertDirectory(workspace, "工作目錄");
assertDirectory(currentPluginRoot, "現行 Plugin 目錄");
assertDirectory(sourceSnapshotRoot, "來源快照目錄");
if (!fs.existsSync(planPath)) throw new Error(`找不到更新計畫：${planPath}`);

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.schemaVersion !== PLAN_SCHEMA) throw new Error(`更新計畫 schemaVersion 必須是 ${PLAN_SCHEMA}。`);
if (plan.confirmed !== true) throw new Error("更新計畫尚未確認，confirmed 必須為 true。");
if (!Array.isArray(plan.changes) || plan.changes.length === 0) throw new Error("更新計畫沒有 changes。");
if (!plan.versionReason || typeof plan.versionReason !== "string") throw new Error("更新計畫缺少 versionReason。");

const validatorPath = path.join(currentPluginRoot, "skills", "stakeholder-qa-assistant", "scripts", "validate-plugin.mjs");
const baselineValidation = spawnSync(process.execPath, [validatorPath], {
  cwd: currentPluginRoot,
  encoding: "utf8"
});
if (baselineValidation.status !== 0) {
  throw new Error(`現行 Plugin 驗證失敗，不能建立候選版本。\n${baselineValidation.stdout}${baselineValidation.stderr}`);
}

const manifestPath = path.join(currentPluginRoot, "plugin.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.version !== plan.currentVersion) {
  throw new Error(`更新計畫的 currentVersion 與現行 Plugin 不一致：${plan.currentVersion} / ${manifest.version}`);
}
const sourceIndexPath = path.join(currentPluginRoot, "skills", "stakeholder-qa-assistant", "references", "source-index.md");
const sourceIndex = parseSourceIndex(sourceIndexPath);

const sourceEntries = fs.readdirSync(sourceSnapshotRoot, { withFileTypes: true })
  .filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("~$"));
const nestedDirectories = sourceEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (nestedDirectories.length > 0) {
  throw new Error(`來源快照不得包含子目錄：${nestedDirectories.join("、")}`);
}
const incomingFiles = sourceEntries
  .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && !entry.name.startsWith("~$"))
  .map((entry) => entry.name);
if (incomingFiles.length === 0) throw new Error("來源快照不可為空。");
const unsupportedFiles = incomingFiles.filter((name) => !SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()));
if (unsupportedFiles.length > 0) {
  throw new Error(`來源快照含不支援格式：${unsupportedFiles.join("、")}`);
}
const incomingSet = new Set(incomingFiles);
const currentByFile = new Map([...sourceIndex.active.values()].map((source) => [path.basename(source.sourcePath), source]));
const incomingHashes = new Map(incomingFiles.map((name) => [name, sha256File(path.join(sourceSnapshotRoot, name))]));

const unchangedFiles = new Set();
for (const [name, source] of currentByFile) {
  if (incomingSet.has(name) && incomingHashes.get(name) === source.hash) unchangedFiles.add(name);
}

const coveredCurrent = new Map();
const coveredIncoming = new Map();
const allowedActions = new Set(["replace", "rename", "add", "remove"]);
for (const [index, change] of plan.changes.entries()) {
  if (!allowedActions.has(change.action)) throw new Error(`changes[${index}] 的 action 不正確：${change.action}`);
  if (!/^SRC-\d{3}$/.test(change.sourceId ?? "")) throw new Error(`changes[${index}] 的 sourceId 不正確。`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(change.markdown ?? "")) {
    throw new Error(`changes[${index}] 的 markdown 必須是小寫 kebab-case .md：${change.markdown}`);
  }
  if (change.action !== "add") {
    safeFileName(change.currentFile, `changes[${index}].currentFile`);
    const source = sourceIndex.active.get(change.sourceId);
    if (!source) throw new Error(`${change.sourceId} 不是有效來源。`);
    if (path.basename(source.sourcePath) !== change.currentFile || source.markdown !== change.markdown) {
      throw new Error(`${change.sourceId} 的 currentFile 或 markdown 與來源索引不一致。`);
    }
    if (coveredCurrent.has(change.currentFile)) throw new Error(`現行來源被重複處理：${change.currentFile}`);
    if (unchangedFiles.has(change.currentFile)) throw new Error(`未變更來源不應出現在更新計畫：${change.currentFile}`);
    coveredCurrent.set(change.currentFile, change);
  }
  if (change.action !== "remove") {
    safeFileName(change.incomingFile, `changes[${index}].incomingFile`);
    if (!incomingSet.has(change.incomingFile)) throw new Error(`來源快照沒有檔案：${change.incomingFile}`);
    if (coveredIncoming.has(change.incomingFile)) throw new Error(`新版來源被重複處理：${change.incomingFile}`);
    coveredIncoming.set(change.incomingFile, change);
  }
  if (change.action === "rename") {
    const currentHash = sourceIndex.active.get(change.sourceId).hash;
    if (currentHash !== incomingHashes.get(change.incomingFile)) {
      throw new Error(`rename 只適用內容相同的更名：${change.currentFile} / ${change.incomingFile}`);
    }
  }
  if (change.action === "remove" && (!change.reason || typeof change.reason !== "string")) {
    throw new Error(`移除來源 ${change.sourceId} 必須提供 reason。`);
  }
}

for (const name of currentByFile.keys()) {
  if (!unchangedFiles.has(name) && !coveredCurrent.has(name)) throw new Error(`更新計畫遺漏現行來源：${name}`);
}
for (const name of incomingSet) {
  if (!unchangedFiles.has(name) && !coveredIncoming.has(name)) throw new Error(`更新計畫遺漏新版來源：${name}`);
}

const additions = plan.changes.filter((change) => change.action === "add");
const removals = plan.changes.filter((change) => change.action === "remove");
const structural = additions.length > 0 || removals.length > 0;
if (structural && plan.routeChangesConfirmed !== true) {
  throw new Error("新增或移除來源時，routeChangesConfirmed 必須為 true。");
}

const usedIds = [...sourceIndex.active.keys(), ...sourceIndex.retired.keys()]
  .map((sourceId) => Number(sourceId.slice(4)));
let expectedNextId = Math.max(...usedIds) + 1;
const existingMarkdown = new Set([...sourceIndex.active.values()].map((source) => source.markdown));
for (const addition of additions.sort((left, right) => left.sourceId.localeCompare(right.sourceId))) {
  const expectedId = `SRC-${String(expectedNextId).padStart(3, "0")}`;
  if (addition.sourceId !== expectedId) throw new Error(`新來源 ID 必須依序使用 ${expectedId}。`);
  if (existingMarkdown.has(addition.markdown)) throw new Error(`新來源 Markdown 已存在：${addition.markdown}`);
  existingMarkdown.add(addition.markdown);
  expectedNextId += 1;
}

const recommendedVersion = nextVersion(manifest.version, plan, structural);
if (plan.nextVersion !== recommendedVersion) {
  throw new Error(`nextVersion 不符合版本政策，預期 ${recommendedVersion}，實際 ${plan.nextVersion}。`);
}

const releaseRoot = path.join(workspace, OUTPUT_ROOT, plan.nextVersion);
const candidateRoot = path.join(releaseRoot, CURRENT_PLUGIN);
if (fs.existsSync(releaseRoot)) throw new Error(`輸出版本已存在，不會覆蓋：${releaseRoot}`);

fs.mkdirSync(releaseRoot, { recursive: true });
fs.cpSync(currentPluginRoot, candidateRoot, { recursive: true, errorOnExist: true });

const convertedOn = currentDateTaipei();
for (const change of plan.changes) {
  if (change.action === "remove") {
    const source = sourceIndex.active.get(change.sourceId);
    sourceIndex.active.delete(change.sourceId);
    sourceIndex.retired.set(change.sourceId, {
      sourceId: change.sourceId,
      sourcePath: source.sourcePath,
      retiredOn: convertedOn,
      note: escapeTable(change.reason)
    });
    const referencePath = path.join(candidateRoot, "skills", "stakeholder-qa-assistant", "references", source.markdown);
    if (fs.existsSync(referencePath)) fs.rmSync(referencePath);
    continue;
  }

  const incomingHash = incomingHashes.get(change.incomingFile);
  const sourcePath = `${sourceIndex.sourceScope}${change.incomingFile}`;
  if (change.action === "add") {
    const source = {
      sourceId: change.sourceId,
      sourcePath,
      markdown: change.markdown,
      hash: incomingHash
    };
    sourceIndex.active.set(change.sourceId, source);
    const referencePath = path.join(candidateRoot, "skills", "stakeholder-qa-assistant", "references", change.markdown);
    fs.writeFileSync(referencePath, renderPendingReference(source, convertedOn));
    continue;
  }

  const source = sourceIndex.active.get(change.sourceId);
  source.sourcePath = sourcePath;
  source.hash = incomingHash;
  const referencePath = path.join(candidateRoot, "skills", "stakeholder-qa-assistant", "references", source.markdown);
  if (change.action === "rename") {
    const content = fs.readFileSync(referencePath, "utf8");
    fs.writeFileSync(referencePath, updateFrontmatter(content, {
      source_file: source.sourcePath,
      source_sha256: source.hash,
      converted_on: convertedOn
    }));
  } else {
    fs.writeFileSync(referencePath, renderPendingReference(source, convertedOn));
  }
}

const candidateManifestPath = path.join(candidateRoot, "plugin.json");
const candidateManifest = JSON.parse(fs.readFileSync(candidateManifestPath, "utf8"));
candidateManifest.version = plan.nextVersion;
fs.writeFileSync(candidateManifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`);

const candidateSkillPath = path.join(candidateRoot, "skills", "stakeholder-qa-assistant", "SKILL.md");
let candidateSkill = fs.readFileSync(candidateSkillPath, "utf8");
candidateSkill = candidateSkill.replace(/(^\s+version:\s*)["']?\d+\.\d+\.\d+["']?/m, `$1"${plan.nextVersion}"`);
fs.writeFileSync(candidateSkillPath, candidateSkill);

const candidateSourceIndexPath = path.join(candidateRoot, "skills", "stakeholder-qa-assistant", "references", "source-index.md");
fs.writeFileSync(candidateSourceIndexPath, renderSourceIndex(sourceIndex, convertedOn));

const candidateReadmePath = path.join(candidateRoot, "README.md");
if (fs.existsSync(candidateReadmePath)) {
  let readme = fs.readFileSync(candidateReadmePath, "utf8");
  readme = readme.replace(/`\d+` 份原始文件/, `\`${sourceIndex.active.size}\` 份原始文件`);
  fs.writeFileSync(candidateReadmePath, readme);
}

fs.writeFileSync(path.join(releaseRoot, "confirmed-update-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
const reportRows = plan.changes.map((change) => [
  change.action,
  change.sourceId,
  change.currentFile ?? "—",
  change.incomingFile ?? "—",
  change.markdown
]);
const report = [
  "# 利害關係人 QA 小幫手更新報告",
  "",
  `- 現行版本：\`${manifest.version}\``,
  `- 候選版本：\`${plan.nextVersion}\``,
  `- 版本理由：${plan.versionReason}`,
  `- 建立日期：\`${convertedOn}\``,
  `- 有效來源：\`${sourceIndex.active.size}\``,
  `- 已停用來源：\`${sourceIndex.retired.size}\``,
  "",
  "## 已確認異動",
  "",
  "| 動作 | 來源 ID | 現行檔案 | 新版檔案 | Markdown |",
  "|---|---|---|---|---|",
  ...reportRows.map((row) => `| ${row.map(escapeTable).join(" | ")} |`),
  "",
  "## 發布狀態",
  "",
  `候選目錄已建立。含有 \`${CONVERSION_MARKER}\` 的 reference 尚待重新轉換；完成 reference、問題路由及人工核對後，再執行發布驗證。`,
  ""
].join("\n");
fs.writeFileSync(path.join(releaseRoot, "update-report.md"), report);

process.stdout.write(`${JSON.stringify({
  schemaVersion: "stakeholder-qa-candidate.v1",
  workspace,
  currentVersion: manifest.version,
  nextVersion: plan.nextVersion,
  candidateRoot,
  releaseRoot,
  activeSources: sourceIndex.active.size,
  retiredSources: sourceIndex.retired.size,
  pendingConversions: plan.changes.filter((change) => change.action === "replace" || change.action === "add").map((change) => change.markdown)
}, null, 2)}\n`);
