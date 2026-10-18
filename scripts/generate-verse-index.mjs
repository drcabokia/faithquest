// Metadata only; Scripture words stay in the publisher-derived chapter files.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
const chapters = {},
  empty = [];
for (const book of (await readdir("public/bible", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  for (const file of (await readdir(`public/bible/${book.name}`))
    .filter((name) => /^\d+\.json$/.test(name))
    .sort((a, b) => parseInt(a) - parseInt(b))) {
    const chapter = JSON.parse(
      await readFile(`public/bible/${book.name}/${file}`, "utf8"),
    );
    const key = `${chapter.book}.${chapter.chapter}`;
    chapters[key] = Math.max(...chapter.verses.map((v) => v.number));
    for (const verse of chapter.verses)
      if (!verse.text) empty.push(`${key}.${verse.number}`);
  }
}
if (Object.keys(chapters).length !== 1189)
  throw new Error("The complete canonical chapter catalogue is required.");
await writeFile(
  "src/data/verse-index.json",
  await format(JSON.stringify({ chapters, empty }), {
    ...(await resolveConfig("src/data/verse-index.json")),
    parser: "json",
  }),
  "utf8",
);
console.log(
  "Generated verse references for 1,189 chapters; Scripture text was not changed.",
);
