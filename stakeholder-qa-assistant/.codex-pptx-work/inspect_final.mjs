import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const input = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant/.codex-pptx-output/利害關係人QA小幫手_現況與改善重點_v5.pptx";
const outputDir = "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant/.codex-pptx-work/final-v5";

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
const inspection = await presentation.inspect({
  select: "$.slides[*]",
  include: [
    "id",
    "index",
    "layout",
    "title",
    "elements.id",
    "elements.kind",
    "elements.name",
    "elements.text",
    "elements.position",
    "elements.style",
    "notes.text",
  ],
});
await fs.writeFile(path.join(outputDir, "content.ndjson"), `${inspection.ndjson}\n`);

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(
    path.join(outputDir, `${stem}.png`),
    await presentation.export({ slide, format: "png", scale: 1.5 }),
  );
  await fs.writeFile(
    path.join(outputDir, `${stem}.layout.json`),
    await (await slide.export({ format: "layout", detail: "full" })).text(),
  );
}
await writeBlob(
  path.join(outputDir, "montage.webp"),
  await presentation.export({ format: "webp", montage: true, scale: 1 }),
);
