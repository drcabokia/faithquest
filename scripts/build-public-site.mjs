import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Only these public inputs are read. This build never loads .env or app code.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(
  await readFile(join(root, "src/content/site.json"), "utf8"),
);
const legal = JSON.parse(
  await readFile(join(root, "src/content/legal.json"), "utf8"),
);
if (
  !site.operatorName.trim() ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contactEmail)
)
  throw new Error("Public operator/contact details are required");
for (const key of ["publicOrigin", "appOrigin"]) {
  const origin = new URL(site[key]);
  if (origin.protocol !== "https:" || origin.origin !== site[key])
    throw new Error("Use exact HTTPS site origins");
}
if (site.publicOrigin === site.appOrigin)
  throw new Error(
    "Information site must remain separate from the protected app",
  );
const output = join(root, ".cache/public-information-site");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const brand = `<a class="brand" href="/" aria-label="FaithQuest365 home"><img src="/brand/faithquest365-mark.svg" width="46" height="46" alt=""><span>FaithQuest<span class="brand-365">365</span><small>YOUR DAILY WALK IN THE WORD</small></span></a>`;
const links =
  '<nav class="legal-links" aria-label="Legal information"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></nav>';
const contact = `<a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a>`;
const signature = `<small class="site-signature">By ${escape(site.operatorName)}</small>`;
if (!/^[A-Za-z0-9_-]+$/.test(site.googleSiteVerification ?? ""))
  throw new Error("A Google site verification value is required");
function page(title, description, path, body) {
  const verification =
    path === "/"
      ? `<meta name="google-site-verification" content="${escape(site.googleSiteVerification)}" />`
      : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${verification}<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} | FaithQuest365</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(site.publicOrigin + path)}"><link rel="icon" href="/brand/faithquest365-mark.svg"><link rel="apple-touch-icon" href="/brand/faithquest365-logo-512.png"><link rel="stylesheet" href="/brand/information.css"></head><body class="public-site"><a href="#main-content" class="skip-link">Skip to content</a>${body}</body></html>\n`;
}
function document(kind) {
  const data = legal[kind];
  const sections = data.sections
    .map(
      (section) =>
        `<section id="${escape(section.id)}"><h2>${escape(section.title)}</h2>${section.paragraphs.map((text) => `<p>${escape(text)}</p>`).join("")}${section.items ? `<ul>${section.items.map((text) => `<li>${escape(text)}</li>`).join("")}</ul>` : ""}${section.links ? `<ul>${section.links.map((link) => `<li><a href="${escape(link.href)}">${escape(link.label)}</a></li>`).join("")}</ul>` : ""}</section>`,
    )
    .join("");
  const contents = data.sections
    .map(
      (section) =>
        `<a href="#${escape(section.id)}">${escape(section.title)}</a>`,
    )
    .join("");
  return page(
    data.title,
    data.description,
    `/${kind}`,
    `<div class="legal-page"><header class="legal-header">${brand}<a href="${escape(site.appOrigin)}/login">Open FaithQuest365</a></header><main id="main-content" class="legal-document"><p class="eyebrow">YOUR INFORMATION. YOUR JOURNEY.</p><h1>${escape(data.title)}</h1><p class="legal-date">Last updated: ${escape(site.updated)}</p><p>${escape(data.intro)}</p><p>FaithQuest365 is operated by <strong>${escape(site.operatorName)}</strong>. Contact: ${contact}.</p><nav class="legal-contents" aria-label="On this page">${contents}<a href="#contact">Contact</a></nav>${sections}<section id="contact"><h2>Contact</h2><p>For privacy requests, service questions or concerns, contact ${escape(site.operatorName)} at ${contact}.</p></section></main><footer class="legal-footer">${signature}<a href="/">FaithQuest365 home</a>${links}</footer></div>`,
  );
}
const home = page(
  "A daily walk in the Word",
  "FaithQuest365 is a 365-day Bible reading and reflection app with personal study tools, reading plans and optional private fellowship groups.",
  "/",
  `<div class="information-wrap"><header class="information-header">${brand}<nav aria-label="Website navigation"><a href="#the-journey">The journey</a><a href="/privacy">Privacy</a><a href="${escape(site.appOrigin)}/login">Open test app →</a></nav></header><main id="main-content"><section class="information-hero"><div><p class="information-eyebrow">A LITTLE CLOSER, EVERY DAY</p><h1>A year in the Word.<br><em>A journey of faith.</em></h1><p>FaithQuest365 helps you discover the Bible one day at a time. Follow a reading plan, pause to reflect, and build a rhythm that fits your life.</p><a class="information-button" href="${escape(site.appOrigin)}/login">Open FaithQuest365 →</a><p class="information-pilot">Currently in a small, invitation-only test release.</p></div><figure class="information-mark"><img src="/brand/faithquest365-mark.svg" width="270" height="270" alt="An open Bible with a golden path toward light"><figcaption>Read. Discover. Grow in Faith.</figcaption></figure></section><section id="the-journey" class="information-features"><p class="information-eyebrow">MAKE SPACE FOR YOUR DAILY WALK</p><h2>One meaningful step at a time.</h2><div class="information-grid"><article><h3>A path through Scripture</h3><p>Read the World English Bible with a 365-day Canonical or Balanced plan, a place to resume, and room to catch up.</p></article><article><h3>Space to reflect</h3><p>Keep a personal journal, prayer requests and private verse notes. Save verses and choose a few for memory practice.</p></article><article><h3>Encouragement along the way</h3><p>Revisit your reading with quizzes, optional challenges and private, opt-in fellowship groups.</p></article></div></section><section class="information-care"><h2>Your journey, handled with care.</h2><p>Google sign-in connects your saved progress across devices. Your journal, prayers and notes stay private to your account within the app. Read our <a href="/privacy">Privacy Policy</a> for how information is stored and used, and our <a href="/terms">Terms of Service</a> for the test-release conditions.</p></section></main><footer class="information-footer"><div>${signature}<p>${contact}</p></div>${links}</footer></div>`,
);

const assets = [
  "faithquest365-mark.svg",
  "faithquest365-wordmark.svg",
  "faithquest365-logo-120.png",
  "faithquest365-logo-512.png",
  "information.css",
];
const files = new Set([
  "index.html",
  "privacy.html",
  "terms.html",
  "404.html",
  "vercel.json",
  "robots.txt",
  ...assets.map((name) => `brand/${name}`),
]);
await mkdir(join(output, "brand"), { recursive: true });
// Refuse stale/unexpected output rather than accidentally uploading another app.
for (const entry of await readdir(output, {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile()) continue;
  const parent = entry.parentPath ?? entry.path;
  const relative = join(parent, entry.name)
    .slice(output.length + 1)
    .replaceAll("\\", "/");
  if (!files.has(relative))
    throw new Error(`Unexpected public artifact: ${relative}`);
}
await writeFile(join(output, "index.html"), home);
await writeFile(join(output, "privacy.html"), document("privacy"));
await writeFile(join(output, "terms.html"), document("terms"));
await writeFile(
  join(output, "404.html"),
  page(
    "Page not found",
    "Return to FaithQuest365's information website.",
    "/404",
    '<main id="main-content" class="legal-page legal-document"><h1>Page not found</h1><p><a href="/">Return to FaithQuest365</a></p></main>',
  ),
);
await writeFile(join(output, "robots.txt"), "User-agent: *\nAllow: /\n");
for (const asset of assets)
  await copyFile(
    join(root, "public/brand", asset),
    join(output, "brand", asset),
  );
await writeFile(
  join(output, "vercel.json"),
  JSON.stringify(
    {
      cleanUrls: true,
      trailingSlash: false,
      headers: [
        {
          source: "/(.*)",
          headers: [
            {
              key: "Content-Security-Policy",
              value:
                "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            },
            { key: "X-Content-Type-Options", value: "nosniff" },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
            },
          ],
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Public information site built at ${output}. Only homepage, legal documents and brand assets are included.`,
);
