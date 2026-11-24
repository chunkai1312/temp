import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant";
const sourcePath = path.join(workspaceDir, "利害關係人QA小幫手.pptx");
const skillDir = "/Users/ckwang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations";
const buildDir = path.join(workspaceDir, ".codex-pptx-work", "build-v2");
const outputDir = path.join(workspaceDir, ".codex-pptx-output");
const finalPath = path.join(outputDir, "利害關係人QA小幫手_解決方案概述_v2.pptx");
const runtimePython = "/Users/ckwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const fontFamily = "Microsoft JhengHei";

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
    typeface: fontFamily,
    fontSize,
    color,
    bold,
    alignment,
    verticalAlignment,
    autoFit: "shrinkText",
  };
  return shape;
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePath),
  );

  const contentLayout = presentation.layouts.items.find(
    (layout) => layout.name === "標題及物件",
  );
  if (!contentLayout) throw new Error("找不到「標題及物件」版面配置");

  const { slide } = presentation.slides.insert({
    after: presentation.slides.items[0],
    layoutId: contentLayout.id,
  });

  addText(slide, {
    name: "solution-overview-title",
    text: "解決方案概述",
    position: { left: 18.83, top: 7.56, width: 1171.83, height: 56.69 },
    fontSize: 38.4,
    color: "#111111",
    bold: true,
  });

  addText(slide, {
    name: "solution-summary",
    text: "整合 11 份外規、內規、操作手冊與問答集，建立標準化 Agent Skill，\n供使用者在 Spade 查詢，並回溯原始依據。",
    position: { left: 57, top: 92, width: 1095, height: 82 },
    fontSize: 26.67,
    color: "#3D3D3D",
    bold: true,
  });

  slide.shapes.add({
    geometry: "line",
    name: "process-baseline",
    position: { left: 95, top: 244, width: 1018, height: 0 },
    fill: "none",
    line: { style: "solid", fill: "#D9D9D9", width: 2 },
  });

  const stages = [
    {
      number: "01",
      centerLeft: 151,
      textLeft: 60,
      title: "原始文件",
      description: "外規、內規、操作手冊\n與問答集，共 11 份",
    },
    {
      number: "02",
      centerLeft: 431,
      textLeft: 340,
      title: "知識整理",
      description: "一對一轉換，保留頁碼、\n條次與 FAQ 題號",
    },
    {
      number: "03",
      centerLeft: 711,
      textLeft: 620,
      title: "Agent Skill",
      description: "依問題選擇來源，\n資訊不足時保守回答",
    },
    {
      number: "04",
      centerLeft: 991,
      textLeft: 900,
      title: "Spade 問答",
      description: "以自然語言提問，\n回覆標示來源依據",
    },
  ];

  for (const stage of stages) {
    const number = slide.shapes.add({
      geometry: "ellipse",
      name: `stage-${stage.number}-number`,
      position: { left: stage.centerLeft, top: 219, width: 48, height: 48 },
      fill: "#E60012",
      line: { style: "solid", fill: "#E60012", width: 0 },
    });
    number.text = stage.number;
    number.text.insets = 0;
    number.text.style = {
      typeface: fontFamily,
      fontSize: 16,
      color: "#FFFFFF",
      bold: true,
      alignment: "center",
      verticalAlignment: "middle",
    };

    addText(slide, {
      name: `stage-${stage.number}-title`,
      text: stage.title,
      position: { left: stage.textLeft, top: 286, width: 230, height: 34 },
      fontSize: 21.33,
      color: "#111111",
      bold: true,
      alignment: "center",
    });

    addText(slide, {
      name: `stage-${stage.number}-description`,
      text: stage.description,
      position: { left: stage.textLeft, top: 329, width: 230, height: 62 },
      fontSize: 17.33,
      color: "#6B6B6B",
      alignment: "center",
      verticalAlignment: "top",
    });
  }

  slide.shapes.add({
    geometry: "rect",
    name: "usage-boundary",
    position: { left: 57, top: 448, width: 1095, height: 82 },
    fill: "#F3F3F3",
    line: { style: "solid", fill: "none", width: 0 },
  });
  slide.shapes.add({
    geometry: "rect",
    name: "usage-boundary-accent",
    position: { left: 57, top: 448, width: 4.8, height: 82 },
    fill: "#E60012",
    line: { style: "solid", fill: "none", width: 0 },
  });
  addText(slide, {
    name: "usage-boundary-title",
    text: "使用邊界",
    position: { left: 85, top: 467, width: 135, height: 48 },
    fontSize: 20,
    color: "#111111",
    bold: true,
  });
  addText(slide, {
    name: "usage-boundary-copy",
    text: "僅依知識文件提供說明，不執行申報、不修改正式系統、不查詢即時客戶資料，最終仍由權責單位確認。",
    position: { left: 220, top: 467, width: 895, height: 48 },
    fontSize: 17.33,
    color: "#3D3D3D",
  });

  slide.speakerNotes.text = [
    "內容依據：",
    path.join(workspaceDir, "stakeholder-qa-assistant-plugin/skills/stakeholder-qa-assistant/SKILL.md"),
    path.join(workspaceDir, "stakeholder-qa-assistant-plugin/skills/stakeholder-qa-assistant/references/source-index.md"),
  ].join("\n");
  slide.speakerNotes.setVisible(true);

  await writeBlob(
    path.join(buildDir, "solution-overview.png"),
    await presentation.export({ slide, format: "png", scale: 2 }),
  );
  await fs.writeFile(
    path.join(buildDir, "solution-overview.layout.json"),
    await (await slide.export({ format: "layout", detail: "full" })).text(),
  );
  await writeBlob(
    path.join(buildDir, "deck-montage-before-finalize.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );

  const { finalizePresentation } = await import(pathToFileURL(
    path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
  ).href);
  const stagingDir = path.join(buildDir, "finalizer");
  await fs.mkdir(stagingDir, { recursive: true });
  const candidatePath = path.join(stagingDir, "candidate.pptx");
  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

  const requirements = {
    explicitTotalSlideCount: 10,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
  };
  const fontPolicy = {
    basis: "design",
    families: ["Microsoft JhengHei", "微軟正黑體", "Arial"],
  };
  const result = await finalizePresentation({
    ...requirements,
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
    ],
    requiredNativeTableOwnerSlides: [],
    fontPolicy,
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, "validation.json"),
  });
  console.log(JSON.stringify({ finalPath, result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
