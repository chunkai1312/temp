import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant";
const sourcePath = path.join(workspaceDir, "利害關係人QA小幫手.pptx");
const skillDir = "/Users/ckwang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations";
const buildDir = path.join(workspaceDir, ".codex-pptx-work", "boundary-v4");
const outputDir = path.join(workspaceDir, ".codex-pptx-output");
const finalPath = path.join(outputDir, "利害關係人QA小幫手_使用邊界精簡_v4.pptx");
const runtimePython = "/Users/ckwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const match = await presentation.inspect({
  select: "$.slides[*].elements[?(@.name == 'usage-boundary-copy')]",
  include: ["id", "name", "text", "position", "style"],
});
if (match.recordCount !== 1) {
  throw new Error(`預期找到 1 個 usage-boundary-copy，實際找到 ${match.recordCount} 個`);
}

const targetId = match.records[0].id;
const target = presentation.resolve(targetId);
const slide = presentation.slides.items[1];

await writeBlob(
  path.join(buildDir, "before.png"),
  await presentation.export({ slide, format: "png", scale: 2 }),
);

target.text = "回答以目前納入的 11 份知識文件為限，法規效力及個案判斷仍由權責單位確認。";

await writeBlob(
  path.join(buildDir, "after.png"),
  await presentation.export({ slide, format: "png", scale: 2 }),
);
await fs.writeFile(
  path.join(buildDir, "after.layout.json"),
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
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [],
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
  ],
  fontPolicy: {
    basis: "design",
    families: ["Microsoft JhengHei", "微軟正黑體"],
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "validation.json"),
});

console.log(JSON.stringify({ targetId, finalPath, result }, null, 2));
