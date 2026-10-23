import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = new URL("../public/brand/", import.meta.url);
const source = await readFile(new URL("faithquest365-mark.svg", directory));
for (const size of [120, 512]) {
  const destination = new URL(`faithquest365-logo-${size}.png`, directory);
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(destination));
  const details = await stat(destination);
  if (details.size > 1024 * 1024)
    throw new Error("Logo exceeds Google's 1 MB limit");
  console.log(`Created ${size} × ${size} PNG (${details.size} bytes).`);
}
const body = source
  .toString()
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .trim();
await writeFile(
  new URL("faithquest365-wordmark.svg", directory),
  `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="112" viewBox="0 0 560 112"><title>FaithQuest365</title><g transform="translate(4 8) scale(1.5)">${body}</g><text x="122" y="64" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="600" letter-spacing="-1.8" fill="#184f3c">FaithQuest<tspan fill="#976c20" font-weight="400">365</tspan></text><text x="124" y="88" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="2" fill="#53665a">YOUR DAILY WALK IN THE WORD</text></svg>\n`,
);
console.log("Created editable SVG wordmark.");
