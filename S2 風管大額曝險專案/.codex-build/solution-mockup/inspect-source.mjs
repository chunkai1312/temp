import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = "/Users/ckwang/Projects/work/temp/大額暴險管理系統通報.pptx";
const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));

const overview = await presentation.inspect({
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
  ],
});

console.log(overview.ndjson);
console.log(JSON.stringify({
  masters: presentation.masters.items.map((master) => ({ id: master.id, name: master.name })),
  layouts: presentation.layouts.items.map((layout) => ({
    id: layout.id,
    name: layout.name,
    placeholders: layout.placeholders.summary(),
  })),
}, null, 2));
