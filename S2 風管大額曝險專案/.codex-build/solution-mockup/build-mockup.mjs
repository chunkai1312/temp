import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

process.on("uncaughtException", (error) => {
  console.error(`BUILD_ERROR: ${error?.message ?? error}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`BUILD_ERROR: ${error?.message ?? error}`);
  process.exit(1);
});

const workspaceDir = "/Users/ckwang/Projects/work/temp/S2 風管大額曝險專案";
const sourcePath = "/Users/ckwang/Projects/work/temp/大額暴險管理系統通報.pptx";
const buildDir = path.join(workspaceDir, ".codex-build", "solution-mockup");
const stagingDir = path.join(workspaceDir, ".codex-finalizer", "solution-mockup");
const outputDir = path.join(workspaceDir, "output");
const finalPath = path.join(outputDir, "大額暴險管理系統通報_解決方案Mockup_v1.pptx");
const previewPath = path.join(outputDir, "大額暴險管理系統通報_解決方案Mockup_v1.png");
const layoutPath = path.join(buildDir, "solution-slide.layout.json");
const candidatePath = path.join(stagingDir, "candidate.pptx");

const SKILL_DIR = "/Users/ckwang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1011.11113/skills/presentations";
const RUNTIME_PYTHON = "/Users/ckwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const FONT = "Microsoft JhengHei";
const RED = "#E60012";
const BLACK = "#111111";
const DARK_GRAY = "#3D3D3D";
const MID_GRAY = "#6B6B6B";
const LIGHT_GRAY = "#D8D8D8";
const PALE_GRAY = "#F4F4F4";

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, {
  name,
  text,
  left,
  top,
  width,
  height,
  fontSize,
  color = BLACK,
  bold = false,
  alignment = "left",
  verticalAlignment = "top",
}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize,
    color,
    bold,
    alignment,
    verticalAlignment,
    autoFit: "shrinkText",
    insets: 0,
  };
  return shape;
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const cover = presentation.slides.getItem(0);
const contentLayout = presentation.layouts.items.find((layout) => layout.name === "標題及物件");
if (!contentLayout) throw new Error("找不到來源簡報的「標題及物件」版面配置");

const { slide } = presentation.slides.insert({
  after: cover,
  layoutId: contentLayout.id,
});
slide.placeholders.addFromLayout();

const title = slide.placeholders.getItem("title");
title.text = "解決方案概述";
title.text.style = {
  typeface: FONT,
  fontSize: 42.67,
  color: BLACK,
  bold: true,
  alignment: "left",
  verticalAlignment: "middle",
  autoFit: "shrinkText",
};

const body = slide.placeholders.getItem("body");
body.text = "";

addText(slide, {
  name: "solution-summary",
  text: "將既有大額暴險文件封裝為標準化 Agent Plugin，\n讓使用者可在 Spade 直接查詢，並追溯回答來源。",
  left: 57,
  top: 92,
  width: 1095,
  height: 82,
  fontSize: 26.67,
  color: DARK_GRAY,
  bold: true,
  verticalAlignment: "middle",
});

slide.shapes.add({
  geometry: "line",
  name: "process-baseline",
  position: { left: 95, top: 244, width: 1018, height: 0 },
  fill: "none",
  line: { style: "solid", fill: LIGHT_GRAY, width: 2 },
});

const stages = [
  {
    number: "01",
    title: "知識庫文件",
    description: "彙整既有規範、作業說明\n與系統操作文件",
  },
  {
    number: "02",
    title: "Markdown 知識",
    description: "每份文件分別轉換，\n保留來源對應",
  },
  {
    number: "03",
    title: "Agent Plugin",
    description: "以 Agent Plugins 1.0\n封裝為可載入的 Skill",
  },
  {
    number: "04",
    title: "Spade 問答",
    description: "以自然語言提問，\n回覆標示來源依據",
  },
];

const stageLefts = [60, 340, 620, 900];
for (let index = 0; index < stages.length; index += 1) {
  const stage = stages[index];
  const left = stageLefts[index];
  const circle = slide.shapes.add({
    geometry: "ellipse",
    name: `stage-${index + 1}-number`,
    position: { left: left + 91, top: 219, width: 48, height: 48 },
    fill: RED,
    line: { style: "solid", fill: RED, width: 1 },
  });
  circle.text = stage.number;
  circle.text.style = {
    typeface: FONT,
    fontSize: 16,
    color: "#FFFFFF",
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    insets: 0,
  };

  addText(slide, {
    name: `stage-${index + 1}-title`,
    text: stage.title,
    left,
    top: 286,
    width: 230,
    height: 34,
    fontSize: 21.33,
    color: BLACK,
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
  });

  addText(slide, {
    name: `stage-${index + 1}-description`,
    text: stage.description,
    left,
    top: 329,
    width: 230,
    height: 62,
    fontSize: 17.33,
    color: MID_GRAY,
    alignment: "center",
    verticalAlignment: "top",
  });
}

const boundary = slide.shapes.add({
  geometry: "rect",
  name: "usage-boundary",
  position: { left: 57, top: 448, width: 1095, height: 104 },
  fill: PALE_GRAY,
  line: { style: "solid", fill: "none", width: 0 },
});
boundary.sendToBack();

slide.shapes.add({
  geometry: "rect",
  name: "usage-boundary-accent",
  position: { left: 57, top: 448, width: 6, height: 104 },
  fill: RED,
  line: { style: "solid", fill: RED, width: 0 },
});

addText(slide, {
  name: "usage-boundary-title",
  text: "使用邊界",
  left: 85,
  top: 467,
  width: 135,
  height: 30,
  fontSize: 20,
  color: BLACK,
  bold: true,
  verticalAlignment: "middle",
});

addText(slide, {
  name: "usage-boundary-copy",
  text: "僅依知識庫文件回答；不執行正式申報、不修改正式系統，也不查詢客戶即時資料。",
  left: 220,
  top: 467,
  width: 895,
  height: 48,
  fontSize: 18.67,
  color: DARK_GRAY,
  verticalAlignment: "middle",
});

slide.speakerNotes.text = [
  "內容依據：",
  "/Users/ckwang/Projects/work/temp/S2 風管大額曝險專案/sinopac-large-exposure-plugin/README.md",
  "/Users/ckwang/Projects/work/temp/S2 風管大額曝險專案/sinopac-large-exposure-plugin/skills/large-exposure-reporting/SKILL.md",
];
slide.speakerNotes.setVisible(true);

await writeBlob(layoutPath, await slide.export({ format: "layout", detail: "full" }));
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs"),
).href);

await finalizePresentation({
  explicitTotalSlideCount: 9,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "11520488,6480175",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: {
    basis: "reference",
    families: ["Microsoft JhengHei", "微軟正黑體"],
    referencePath: sourcePath,
    referenceSha256: "8b64af0e4930afdaa22fe1261b7e8353460fa7f2b20cba3ae03f7751e36486e5",
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "validation.json"),
});

const finalPresentation = await PresentationFile.importPptx(await FileBlob.load(finalPath));
const finalSlide = finalPresentation.slides.getItem(1);
await writeBlob(previewPath, await finalSlide.export({ format: "png", scale: 2 }));

console.log(JSON.stringify({ finalPath, previewPath, layoutPath }, null, 2));
