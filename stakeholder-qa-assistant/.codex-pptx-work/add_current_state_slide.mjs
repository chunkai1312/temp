import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant";
const sourcePath = path.join(workspaceDir, "利害關係人QA小幫手.pptx");
const skillDir = "/Users/ckwang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations";
const buildDir = path.join(workspaceDir, ".codex-pptx-work", "current-state-v5");
const outputDir = path.join(workspaceDir, ".codex-pptx-output");
const finalPath = path.join(outputDir, "利害關係人QA小幫手_現況與改善重點_v5.pptx");
const runtimePython = "/Users/ckwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const typeface = "Microsoft JhengHei";

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, {
  name,
  text,
  position,
  fontSize,
  color,
  bold = false,
  alignment = "left",
  verticalAlignment = "middle",
}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.insets = 0;
  shape.text.style = {
    typeface,
    fontSize,
    color,
    bold,
    alignment,
    verticalAlignment,
    autoFit: "shrinkText",
  };
  return shape;
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const contentLayout = presentation.layouts.items.find(
  (layout) => layout.name === "標題及物件",
);
if (!contentLayout) throw new Error("找不到「標題及物件」版面配置");

const { slide } = presentation.slides.insert({
  after: presentation.slides.items[0],
  layoutId: contentLayout.id,
});

addText(slide, {
  name: "current-state-title",
  text: "現況與改善重點",
  position: { left: 18.83, top: 7.56, width: 1171.83, height: 56.69 },
  fontSize: 38.4,
  color: "#111111",
  bold: true,
});

addText(slide, {
  name: "current-state-summary",
  text: "既有 POC 已驗證 RAG 與文件檢索的可行性，實際使用仍需補強查詢精準度與來源追溯。",
  position: { left: 57, top: 82, width: 1095, height: 64 },
  fontSize: 24,
  color: "#3D3D3D",
  bold: true,
});

const values = [
  ["現況", "可能影響"],
  ["問題路由依賴關鍵字", "混合意圖的問題可能只命中部分內容"],
  ["文件採切片檢索", "主規定、例外條件及適用範圍可能分散於不同片段"],
  ["FAQ 與正式規範共同召回", "相似案例的條件不同，仍可能被直接套用"],
  ["交易必要條件未先檢查", "缺少主體、對象、金額或日期時，回答可能過度推論"],
  ["多種衍生資料並存", "回答需要額外比對原始文件及版本"],
];

const table = slide.tables.add({
  rows: values.length,
  columns: 2,
  left: 57,
  top: 162,
  width: 1095,
  height: 328,
  columnWidths: [345, 750],
  values,
});
table.borders.assign({ style: "solid", fill: "#D9D9D9", width: 1 });
table.styleOptions = {
  headerRow: false,
  totalRow: false,
  firstColumn: false,
  lastColumn: false,
  bandedRows: false,
  bandedColumns: false,
};
table.rows[0].height = 42;
for (let row = 1; row < values.length; row += 1) table.rows[row].height = 57.2;

table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 2 }).assign({
  fill: "#E60012",
  textStyle: {
    typeface,
    fontSize: 17.33,
    color: "#FFFFFF",
    bold: true,
    alignment: "center",
  },
  margins: { top: 6, right: 12, bottom: 6, left: 12 },
  anchor: "middle",
});

for (let row = 1; row < values.length; row += 1) {
  table.cells.block({ row, column: 0, rowCount: 1, columnCount: 2 }).assign({
    fill: row % 2 === 1 ? "#F5F5F5" : "#FFFFFF",
    textStyle: {
      typeface,
      fontSize: 16,
      color: "#3D3D3D",
      alignment: "left",
    },
    margins: { top: 7, right: 12, bottom: 7, left: 12 },
    anchor: "middle",
  });
  table.getCell(row, 0).text.style = {
    typeface,
    fontSize: 16,
    color: "#111111",
    bold: true,
    alignment: "left",
  };
}

slide.shapes.add({
  geometry: "rect",
  name: "improvement-focus",
  position: { left: 57, top: 512, width: 1095, height: 74 },
  fill: "#F3F3F3",
  line: { style: "solid", fill: "none", width: 0 },
});
slide.shapes.add({
  geometry: "rect",
  name: "improvement-focus-accent",
  position: { left: 57, top: 512, width: 4.8, height: 74 },
  fill: "#E60012",
  line: { style: "solid", fill: "none", width: 0 },
});
addText(slide, {
  name: "improvement-focus-title",
  text: "改善重點",
  position: { left: 85, top: 525, width: 135, height: 48 },
  fontSize: 20,
  color: "#111111",
  bold: true,
});
addText(slide, {
  name: "improvement-focus-copy",
  text: "先確認問題類型與必要條件，再選擇適用來源，回答同時標示原始依據。",
  position: { left: 220, top: 525, width: 895, height: 48 },
  fontSize: 17.33,
  color: "#3D3D3D",
});

slide.speakerNotes.text = [
  "內容依據：",
  path.join(workspaceDir, "POC/stakeholders QA assistant/rag_optimized_output/retrieval_profiles.json"),
  path.join(workspaceDir, "POC/stakeholders QA assistant/rag_optimized_output/retrieval_strategy.md"),
  path.join(workspaceDir, "POC/stakeholders QA assistant/HANDOVER.md"),
].join("\n");
slide.speakerNotes.setVisible(true);

await writeBlob(
  path.join(buildDir, "current-state.png"),
  await presentation.export({ slide, format: "png", scale: 2 }),
);
await fs.writeFile(
  path.join(buildDir, "current-state.layout.json"),
  await (await slide.export({ format: "layout", detail: "full" })).text(),
);
await writeBlob(
  path.join(buildDir, "montage.webp"),
  await presentation.export({ format: "webp", montage: true, scale: 1 }),
);

const stagingDir = path.join(buildDir, "finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
).href);

const result = await finalizePresentation({
  explicitTotalSlideCount: 11,
  requiredNativeTableOwnerSlides: [2],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "11520488,6480175",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "2",
  ],
  fontPolicy: {
    basis: "design",
    families: ["Microsoft JhengHei", "微軟正黑體"],
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "validation.json"),
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
