#!/usr/bin/env node
// Sync commands/zilliz/*.toml from zilliztech/zilliz-plugin upstream SKILL.md files.
//
// Usage:
//   node scripts/sync.mjs             # rewrite TOMLs in place, update .sync-state.json
//   node scripts/sync.mjs --check     # exit 1 if anything differs from upstream
//   node scripts/sync.mjs --dry-run   # print what would change, don't write
//
// Scope: the 12 domain commands. setup.toml, quickstart.toml, status.toml are
// hand-maintained (setup has no upstream; quickstart/status have been adapted
// for Gemini CLI framing).
//
// Requires: Node 18+ (built-in fetch).

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM = 'zilliztech/zilliz-plugin';
const BRANCH = process.env.SYNC_BRANCH || 'main';
const DOMAINS = [
  'cluster', 'database', 'collection', 'partition', 'index', 'vector',
  'import', 'backup', 'user-role', 'monitoring', 'project-region', 'billing',
];

const OUT_DIR = join(REPO_ROOT, 'commands', 'zilliz');
const STATE_PATH = join(REPO_ROOT, '.sync-state.json');
const MODE = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--dry-run')
    ? 'dry'
    : 'write';

const rawUrl = (p) => `https://raw.githubusercontent.com/${UPSTREAM}/${BRANCH}/${p}`;
const apiUrl = (p) =>
  `https://api.github.com/repos/${UPSTREAM}/commits?path=${encodeURIComponent(p)}&per_page=1&sha=${BRANCH}`;

const ghHeaders = { 'User-Agent': 'zilliz-gemini-sync' };
if (process.env.GITHUB_TOKEN) ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

function stripFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: md };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

// Translate Claude-specific phrasing so the prompt reads natively in Gemini CLI.
function neutralize(body) {
  return body
    .replace(/\bClaude Code\b/g, 'Gemini CLI')
    .replace(/\bClaude CLI\b/g, 'Gemini CLI')
    .replace(/\bClaude\b/g, 'the assistant')
    // "see X skill" / "see the X skill" -> "/zilliz:X" slash command reference.
    .replace(/\bsee (?:the )?([a-z][\w-]*) skill\b/gi, 'run `/zilliz:$1`')
    .replace(/\b(?:the )?([a-z][\w-]*) skill\b/gi, '`/zilliz:$1`');
}

function renderToml(domain, description, body) {
  const prompt = [
    `You are helping the user with Zilliz ${domain} operations via \`zilliz-cli\`.`,
    '',
    body.trim(),
    '',
    '## Live help',
    '',
    `!{zilliz ${domain} --help 2>/dev/null || echo "zilliz-cli not installed — run /zilliz:setup first"}`,
    '',
    'Destructive operations require explicit user confirmation before execution.',
    '',
    'User request: {{args}}',
  ].join('\n');

  // TOML triple-single-quote can't contain ''' . Fall back to triple-double if needed.
  const delim = prompt.includes("'''") ? '"""' : "'''";
  const escapedDesc = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `description = "${escapedDesc}"\nprompt = ${delim}\n${prompt}\n${delim}\n`;
}

async function fetchText(path) {
  const r = await fetch(rawUrl(path), { headers: ghHeaders });
  if (!r.ok) throw new Error(`${r.status} fetching ${path}`);
  return r.text();
}

async function fetchLatestSha(path) {
  const r = await fetch(apiUrl(path), { headers: ghHeaders });
  if (r.status === 403 || r.status === 429) return null; // rate-limited; set GITHUB_TOKEN to avoid
  if (!r.ok) throw new Error(`${r.status} querying commits for ${path}`);
  const arr = await r.json();
  return arr[0]?.sha ?? null;
}

async function syncDomain(domain) {
  const source = `skills/${domain}/SKILL.md`;
  const [md, sha] = await Promise.all([fetchText(source), fetchLatestSha(source)]);
  const { fm, body } = stripFrontmatter(md);
  const description = neutralize(fm.description || `Zilliz ${domain} operations.`);
  const toml = renderToml(domain, description, neutralize(body));

  const outPath = join(OUT_DIR, `${domain}.toml`);
  const current = existsSync(outPath) ? await readFile(outPath, 'utf8') : '';
  const changed = current !== toml;

  if (MODE === 'write' && changed) await writeFile(outPath, toml);
  return { domain, source, sha, changed, outPath };
}

async function main() {
  console.log(`Syncing from ${UPSTREAM}@${BRANCH} (${MODE})`);
  const results = [];
  for (const d of DOMAINS) {
    try {
      results.push(await syncDomain(d));
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('!');
      results.push({ domain: d, error: e.message });
    }
  }
  process.stdout.write('\n');

  const errored = results.filter((r) => r.error);
  const drifted = results.filter((r) => r.changed);
  if (errored.length) {
    for (const r of errored) console.error(`  ERROR ${r.domain}: ${r.error}`);
  }

  if (MODE === 'check') {
    if (drifted.length) {
      console.error('Out of sync:');
      for (const r of drifted) console.error(`  ${r.domain}  (upstream sha ${r.sha})`);
      process.exit(1);
    }
    if (errored.length) process.exit(2);
    console.log('All domains in sync.');
    return;
  }

  if (MODE === 'write') {
    const prev = existsSync(STATE_PATH)
      ? JSON.parse(await readFile(STATE_PATH, 'utf8'))
      : { files: {} };
    const state = {
      upstream: UPSTREAM,
      branch: BRANCH,
      syncedAt: new Date().toISOString(),
      files: { ...prev.files },
    };
    for (const r of results) {
      if (r.error) continue;
      state.files[r.domain] = { source: r.source, sha: r.sha };
    }
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
  }

  if (drifted.length) {
    console.log(`${MODE === 'dry' ? 'Would update' : 'Updated'}: ${drifted.map((r) => r.domain).join(', ')}`);
    console.log('Review changes with `git diff` before committing.');
  } else {
    console.log('No changes.');
  }
  if (errored.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
