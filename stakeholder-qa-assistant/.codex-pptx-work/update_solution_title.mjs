import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant";
const sourcePath = path.join(workspaceDir, "利害關係人QA小幫手.pptx");
const skillDir = "/Users/ckwang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations";
const buildDir = path.join(workspaceDir, ".codex-pptx-work", "solution-title-v6");
const outputDir = path.join(workspaceDir, ".codex-pptx-output");
const finalPath = path.join(outputDir, "利害關係人QA小幫手_改善方案與運作方式_v6.pptx");
const runtimePython = "/Users/ckwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const match = await presentation.inspect({
  select: "$.slides[*].elements[?(@.name == 'solution-overview-title')]",
  include: ["id", "name", "text", "position", "style"],
});
if (match.recordCount !== 1) {
  throw new Error(`預期找到 1 個 solution-overview-title，實際找到 ${match.recordCount} 個`);
}

const target = presentation.resolve(match.records[0].id);
const changedSlide = presentation.slides.items[2];
await writeBlob(
  path.join(buildDir, "before.png"),
  await presentation.export({ slide: changedSlide, format: "png", scale: 2 }),
);

target.text = "改善方案與運作方式";

await writeBlob(
  path.join(buildDir, "after.png"),
  await presentation.export({ slide: changedSlide, format: "png", scale: 2 }),
);
await fs.writeFile(
  path.join(buildDir, "after.layout.json"),
  await (await changedSlide.export({ format: "layout", detail: "full" })).text(),
);

const renderDir = path.join(buildDir, "rendered");
await fs.mkdir(renderDir, { recursive: true });
for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(
    path.join(renderDir, `${stem}.png`),
    await presentation.export({ slide, format: "png", scale: 1.5 }),
  );
}
await writeBlob(
  path.join(renderDir, "montage.webp"),
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

console.log(JSON.stringify({ targetId: match.records[0].id, finalPath, result }, null, 2));
