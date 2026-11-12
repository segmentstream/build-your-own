#!/usr/bin/env node
// Validates every blueprint, rebuilds registry.json and llms.txt, and rejects
// private data patterns. Run `node scripts/check.mjs` to check, and
// `node scripts/check.mjs --write` to regenerate registry.json and llms.txt.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const errors = [];
const fail = (message) => errors.push(message);

const REPO = "segmentstream/build-your-own";
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const ORDER = [
  "marketing-analytics",
  "crm",
  "email-marketing",
  "bookkeeping",
  "ad-fraud-detection",
  "company-agent",
  "drive",
  "e-signature",
];
const FILES = ["README.md", "BLUEPRINT.md", "INTERVIEW.md", "INVARIANTS.md", "VARIATIONS.md", "PITFALLS.md"];
const STATUSES = ["stable", "preview"];
const COMPONENTS = ["ontology", "app", "pipeline", "connections", "events", "agent"];

// ---------- Blueprints ----------

const blueprintsDir = join(root, "blueprints");
const ids = readdirSync(blueprintsDir).filter((name) => statSync(join(blueprintsDir, name)).isDirectory());
const blueprints = [];

for (const id of ids) {
  const dir = join(blueprintsDir, id);
  for (const file of [...FILES, "blueprint.json"]) {
    if (!existsSync(join(dir, file))) fail(`blueprints/${id}: missing ${file}`);
  }
  if (!existsSync(join(dir, "blueprint.json"))) continue;
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(dir, "blueprint.json"), "utf8"));
  } catch (error) {
    fail(`blueprints/${id}/blueprint.json: ${error.message}`);
    continue;
  }
  const where = `blueprints/${id}/blueprint.json`;
  if (meta.id !== id) fail(`${where}: id must be "${id}"`);
  for (const key of ["title", "tagline"]) {
    if (typeof meta[key] !== "string" || !meta[key].trim()) fail(`${where}: ${key} is required`);
  }
  if (!STATUSES.includes(meta.status)) fail(`${where}: status must be one of ${STATUSES.join(", ")}`);
  for (const key of ["replaces", "dependsOn", "worksWith", "components", "sdks", "screens"]) {
    if (!Array.isArray(meta[key])) fail(`${where}: ${key} must be an array`);
  }
  if (typeof meta.reference !== "boolean") fail(`${where}: reference must be true or false`);
  if (!Array.isArray(meta.authors) || !meta.authors.length || meta.authors.some((a) => typeof a !== "string" || !/^[A-Za-z0-9-]+$/.test(a))) {
    fail(`${where}: authors must list at least one GitHub handle`);
  }
  const connections = meta.connections ?? {};
  if (!Array.isArray(connections.required) || !Array.isArray(connections.optional)) {
    fail(`${where}: connections needs required and optional arrays`);
  }
  for (const component of meta.components ?? []) {
    if (!COMPONENTS.includes(component)) fail(`${where}: unknown component "${component}"`);
  }
  blueprints.push(meta);
}

const known = new Set(blueprints.map((meta) => meta.id));
for (const meta of blueprints) {
  for (const dependency of meta.dependsOn ?? []) {
    if (dependency !== "foundation" && !known.has(dependency)) {
      fail(`blueprints/${meta.id}: dependsOn "${dependency}" is not a blueprint`);
    }
  }
  for (const other of meta.worksWith ?? []) {
    if (!known.has(other)) fail(`blueprints/${meta.id}: worksWith "${other}" is not a blueprint`);
  }
}

const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
blueprints.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

// ---------- registry.json and llms.txt ----------

const registry = {
  name: "SegmentStream Build Your Own",
  description:
    "Blueprints for building a company's own software with a coding agent on SegmentStream. Read AGENTS.md first.",
  procedure: "AGENTS.md",
  foundation: "foundation/FOUNDATION.md",
  blueprints: blueprints.map((meta) => ({
    ...meta,
    path: `blueprints/${meta.id}`,
    files: Object.fromEntries(FILES.map((file) => [file.replace(".md", "").toLowerCase(), `blueprints/${meta.id}/${file}`])),
  })),
};
const registryText = `${JSON.stringify(registry, null, 2)}\n`;

const llms = [
  "# SegmentStream Build Your Own",
  "",
  "> Blueprints for building your company's own software with a coding agent: marketing analytics, CRM, email marketing, bookkeeping, ad fraud detection, a company agent, a document drive and e-signature. Each blueprint is a design, an interview, invariants with tests, variations and pitfalls. An agent builds the company's own version on SegmentStream; nothing is installed or forked.",
  "",
  "## Start here",
  "",
  `- [AGENTS.md](${RAW}/AGENTS.md): the build procedure a coding agent follows`,
  `- [registry.json](${RAW}/registry.json): every blueprint with its metadata`,
  `- [Foundation](${RAW}/foundation/FOUNDATION.md): shared companies, contacts, members and conventions`,
  `- [SDKs](${RAW}/SDKS.md): the public SDKs and where they are documented`,
  "",
  "## Blueprints",
  "",
  ...blueprints.map(
    (meta) =>
      `- [${meta.title}](${RAW}/blueprints/${meta.id}/BLUEPRINT.md): ${meta.tagline}${
        meta.replaces.length ? ` Replaces ${meta.replaces.join(", ")}.` : ""
      }`,
  ),
  "",
  "## Optional",
  "",
  `- [How it works](${RAW}/docs/how-it-works.md)`,
  `- [Alternatives](${RAW}/docs/alternatives.md): which blueprint replaces which product`,
  `- [Blueprint format](${RAW}/docs/blueprint-format.md)`,
  "",
].join("\n");

const alternatives = [
  "# Alternatives to popular business software",
  "",
  "Each product below can be replaced by software your coding agent builds from a",
  "blueprint in this repository, shaped to your company and running on",
  "[SegmentStream](https://segmentstream.com). Give your agent",
  "[AGENTS.md](../AGENTS.md) and name the tool you want to replace.",
  "",
  "| Instead of | Build your own | Blueprint |",
  "| --- | --- | --- |",
  ...blueprints
    .flatMap((meta) => meta.replaces.map((product) => ({ product, meta })))
    .sort((a, b) => a.product.localeCompare(b.product, "en", { sensitivity: "base" }))
    .map(({ product, meta }) => `| ${product} | ${meta.title} | [${meta.id}](../blueprints/${meta.id}/) |`),
  "",
  "Product names are trademarks of their owners. They are named only to describe",
  "what a blueprint can replace; no affiliation or endorsement is implied.",
  "",
].join("\n");

for (const [file, text] of [
  ["registry.json", registryText],
  ["llms.txt", llms],
  ["docs/alternatives.md", alternatives],
]) {
  const path = join(root, file);
  if (write) writeFileSync(path, text);
  else if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
    fail(`${file} is out of date: run node scripts/check.mjs --write`);
  }
}

// ---------- Private data and links ----------

const SKIP_DIRS = new Set([".git", "node_modules", "assets"]);
const SKIP_FILES = new Set(["LICENSE", "scripts/check.mjs"]);
const TEXT = /\.(md|json|txt|ya?ml|ts|tsx|js|mjs|py|sql|toml)$/;

const PATTERNS = [
  ["UUID", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ["organization ID", /\borg_[0-9A-Za-z]{16,}\b/],
  ["email outside example domains", /[\w.+-]+@(?!example\.(?:com|org|net)\b)[\w-]+(?:\.[\w-]+)+/],
  ["internal hostname", /\b[\w-]+\.segmentstream\.app\b/],
  ["Cyrillic text", /[Ѐ-ӿ]/],
];
// Names of real people and companies are checked by a private scan before each
// release; a public list of them would itself disclose who they are.

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(path);
    return [path];
  });

for (const path of walk(root)) {
  const file = relative(root, path);
  if (SKIP_FILES.has(file) || !TEXT.test(file)) continue;
  const text = readFileSync(path, "utf8");
  text.split("\n").forEach((line, index) => {
    for (const [label, pattern] of PATTERNS) {
      if (pattern.test(line)) fail(`${file}:${index + 1}: ${label}`);
    }
  });
  if (file.endsWith(".md")) {
    const prose = text.replace(/```[\s\S]*?```/g, "");
    for (const match of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const resolved = resolve(dirname(path), target);
      if (!resolved.startsWith(root)) continue; // links into GitHub UI, such as discussions
      if (!existsSync(resolved)) fail(`${file}: broken link ${match[1]}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((message) => `✗ ${message}`).join("\n"));
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`✓ ${blueprints.length} blueprints, registry.json and llms.txt ${write ? "written" : "up to date"}, no private data patterns.`);
