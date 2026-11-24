import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const inputs = [
  {
    name: "target",
    file: "/Users/ckwang/Projects/work/temp/stakeholder-qa-assistant/利害關係人QA小幫手.pptx",
  },
  {
    name: "reference",
    file: "/Users/ckwang/Projects/work/temp/導航Chat! Skill安裝與說明.pptx",
  },
];

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

for (const input of inputs) {
  const outputDir = path.join(".codex-pptx-work", input.name);
  await fs.mkdir(outputDir, { recursive: true });

  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(input.file),
  );

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
  await fs.writeFile(
    path.join(outputDir, "content.ndjson"),
    `${inspection.ndjson}\n`,
  );

  const metadata = {
    slideCount: presentation.slides.items.length,
    masters: presentation.masters.items.map((master) => ({
      id: master.id,
      name: master.name,
    })),
    layouts: presentation.layouts.items.map((layout) => ({
      id: layout.id,
      name: layout.name,
      placeholders: layout.placeholders.summary(),
    })),
  };
  await fs.writeFile(
    path.join(outputDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(
      path.join(outputDir, `${stem}.png`),
      await presentation.export({ slide, format: "png", scale: 1.5 }),
    );
    const layout = await slide.export({ format: "layout", detail: "full" });
    await fs.writeFile(path.join(outputDir, `${stem}.layout.json`), await layout.text());
  }

  await writeBlob(
    path.join(outputDir, "montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );
}
