const assert = require("node:assert/strict");
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { gzipSync } = require("node:zlib");

const output = join(__dirname, "..", "out");
const tracks = ["associate-foundations", "developer-foundations", "architect-foundations", "architect-professional", "developer-professional"]
  .map((id) => `/certifications/${id}`);
const resources = ["/certifications/december-2026-exam-changes", "/certifications/architect-foundations/city-dispatch-case", "/certifications/methodology"];
// Study guides: one index per track plus one static page per lesson.
const study = tracks.flatMap((track) => {
  const folder = join(__dirname, "..", "out", track.slice(1), "study");
  const lessons = existsSync(folder) ? readdirSync(folder).filter((file) => file.endsWith(".html")).map((file) => `${track}/study/${file.slice(0, -5)}`) : [];
  return [`${track}/study`, ...lessons];
});
const paths = ["/", "/certifications", ...tracks, ...study, "/help", ...resources];
const maxLandingScriptBytes = 350 * 1024;
const read = (file) => readFileSync(join(output, file), "utf8");

assert(existsSync(join(output, "sitemap.xml")), "Run npm run build before checking SEO.");
const urls = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
assert.equal(urls.length, paths.length, "The sitemap should contain every public page once.");
const { origin } = new URL(urls[0]);
const urlFor = (path) => new URL(path, origin).href;
assert.deepEqual(new Set(urls), new Set(paths.map(urlFor)));

const robots = read("robots.txt").trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(robots, ["User-Agent: *", "Allow: /", `Sitemap: ${urlFor("/sitemap.xml")}`]);

function meta(head, key) {
  return [...head.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"\s*\/?\s*>/g)]
    .filter(([, name]) => name === key).map(([, , content]) => content);
}

function metadataValue(head, key, path) {
  const values = meta(head, key);
  assert.equal(values.length, 1, `${path} must include one ${key} tag.`);
  assert(values[0], `${path} has an empty ${key} tag.`);
  return values[0];
}

const titles = new Set();
const descriptions = new Set();
for (const path of paths) {
  const url = urlFor(path);
  const html = read(path === "/" ? "index.html" : `${path.slice(1)}.html`);
  const head = html.match(/<head>(.*?)<\/head>/s)[1];
  const body = html.slice(html.indexOf("</head>") + 7).replace(/<script\b[^>]*>.*?<\/script>/gs, "");
  const canonical = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(([, href]) => new URL(href).href);
  assert.deepEqual(canonical, [url], `${path} has an incorrect canonical.`);
  assert(!meta(head, "robots").some((tag) => tag.includes("noindex")), `${path} is blocked from indexing.`);
  assert.equal([...body.matchAll(/<h1\b/g)].length, 1, `${path} must include one H1 in its HTML.`);
  if (path.startsWith("/certifications")) {
    const scripts = new Set([...html.matchAll(/<script src="\/([^"?]+\.js)/g)].map(([, src]) => src));
    const bytes = [...scripts].reduce((total, src) => total + gzipSync(readFileSync(join(output, src))).length, 0);
    assert(scripts.size && bytes <= maxLandingScriptBytes, `${path} references ${Math.round(bytes / 1024)} KiB of initial JS, above the 350 KiB gzip budget.`);
  }

  const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
  assert(title && !titles.has(title), `${path} needs a unique title.`);
  titles.add(title);
  const description = metadataValue(head, "description", path);
  assert(!descriptions.has(description), `${path} needs a unique description.`);
  descriptions.add(description);

  for (const prefix of ["og", "twitter"]) {
    assert.equal(metadataValue(head, `${prefix}:title`, path), title);
    assert.equal(metadataValue(head, `${prefix}:description`, path), description);
    const image = new URL(metadataValue(head, `${prefix}:image`, path));
    assert.equal(image.origin, origin);
    assert(existsSync(join(output, image.pathname.slice(1))), `Missing ${prefix} image at ${image.pathname}.`);
    metadataValue(head, `${prefix}:image:alt`, path);
  }
  assert.equal(new URL(metadataValue(head, "og:url", path)).href, url);
  assert.equal(metadataValue(head, "twitter:card", path), "summary_large_image");

  const links = new Set([...body.matchAll(/<a\b[^>]* href="([^"#]+)"/g)].map(([, href]) => href));
  const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map(([, json]) => JSON.parse(json));
  if (path === "/") {
    const main = body.match(/<main\b[^>]*>(.*?)<\/main>/s)[1];
    assert.match(main, /<a\b[^>]* href="\/certifications"/, "The city should link to the catalog outside its dialogs.");
    const website = data[0]["@graph"].find((entry) => entry["@type"] === "WebSite");
    assert.equal(website.url, url);
    const publisher = data[0]["@graph"].find((entry) => entry["@id"] === website.publisher["@id"]);
    assert.equal(publisher.name, "CertCity");
  } else if (path === "/certifications") {
    const catalog = data.find((entry) => entry["@type"] === "CollectionPage");
    assert.deepEqual(catalog.mainEntity.itemListElement.map((entry) => entry.url), tracks.map(urlFor));
    for (const track of tracks) assert(links.has(track), `The catalog must link to ${track}.`);
    for (const resource of resources) assert(links.has(resource), `The catalog must link to ${resource}.`);
  } else if (tracks.includes(path)) {
    const breadcrumb = data.find((entry) => entry["@type"] === "BreadcrumbList");
    assert.deepEqual(breadcrumb.itemListElement.map((entry) => entry.item), ["/", "/certifications", path].map(urlFor));
    assert(links.has("/certifications"), `${path} must link back to the catalog.`);
    assert(links.has(`${path}?practice=1`), `${path} must link to its practice workspace.`);
    assert.match(body, /Original sample questions/, `${path} must include sample questions in the initial HTML.`);
    assert.match(body, /Official guide PDF/, `${path} must include the official source in the initial HTML.`);
    for (const other of tracks.filter((track) => track !== path)) assert(links.has(other), `${path} must link to ${other}.`);
  } else if (resources.includes(path)) {
    const breadcrumb = data.find((entry) => entry["@type"] === "BreadcrumbList");
    assert.equal(breadcrumb.itemListElement.at(-1).item, url, `${path} has a missing or incorrect breadcrumb.`);
  }
}

const notFound = read("404.html").match(/<head>(.*?)<\/head>/s)[1];
assert(meta(notFound, "robots").some((tag) => tag.includes("noindex")), "The 404 page should be noindex.");
assert(!notFound.includes('rel="canonical"'), "The 404 page must not claim a canonical URL.");
console.log(`Verified exported SEO for ${paths.length} public pages, the sitemap, robots.txt, the 404 page, and the landing page script budget.`);
