#!/usr/bin/env node
// Sync commands/zilliz/*.toml from zilliztech/zilliz-plugin upstream SKILL.md files.
//
// Usage:
//   node scripts/sync.mjs             # rewrite TOMLs in place, update .sync-state.json
//   node scripts/sync.mjs --check     # exit 1 if anything differs from upstream
//   node scripts/sync.mjs --dry-run   # print what would change, don't write
//
// Scope: the 13 domain commands. setup.toml, quickstart.toml, status.toml are
// hand-maintained (setup has no upstream; quickstart/status have been adapted
// for Gemini CLI framing).
//
// Requires: Node 18+ (built-in fetch).

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM = 'zilliztech/zilliz-plugin';
const BRANCH = process.env.SYNC_BRANCH || 'main';
// Upstream moved skills under plugins/zilliz/ when the repo became a multi-plugin
// marketplace; keep this in one place so a future move is a one-line change.
const SOURCE_PREFIX = 'plugins/zilliz/skills';
const DOMAINS = [
  'cluster', 'database', 'collection', 'partition', 'index', 'vector',
  'import', 'backup', 'user-role', 'acl', 'monitoring', 'project-region', 'billing',
  'external-collection', 'job', 'on-demand-cluster', 'privatelink', 'diagnose',
  'ask-zilliz',
];

// A skill name is not always a `zilliz` subcommand. Map the ones that differ, so
// the injected --help is real output instead of the "not installed" fallback.
// An empty list means the skill is advisory and has no CLI surface of its own.
const HELP_CMDS = {
  'user-role': ['user', 'role'],
  'monitoring': ['cluster', 'collection'],
  'project-region': ['project', 'volume'],
  'diagnose': ['cluster', 'collection'],
  'ask-zilliz': [],
};
const helpCmds = (domain) => HELP_CMDS[domain] ?? [domain];

// Command name when it should read better than the upstream skill name.
// `/zilliz:ask-zilliz` stutters; the command file, its reference dir, and every
// cross-reference to the skill all follow this map.
const COMMAND_NAMES = { 'ask-zilliz': 'ask' };
const commandName = (domain) => COMMAND_NAMES[domain] ?? domain;

// Skills that ship reference material next to SKILL.md. The files are copied into
// references/<domain>/ so the prompt points at something that actually exists.
const ASSET_DIRS = { 'ask-zilliz': 'references' };
const assetOutDir = (domain) => join(REPO_ROOT, 'references', commandName(domain));

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
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const mm = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!mm) continue;
    let value = mm[2].trim();
    // YAML block scalar (`description: |`): take the indented lines that follow.
    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      const block = [];
      while (i + 1 < lines.length && /^(\s+\S|\s*$)/.test(lines[i + 1])) {
        block.push(lines[++i].trim());
      }
      value = block.join('\n').trim();
    }
    fm[mm[1]] = value.replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

// This extension ships no MCP server, so ask-zilliz's Inkeep dependency is
// rewritten onto the reference files we bundle plus the public docs. Rewrites
// are targeted rather than a blanket word swap, so the prose stays grammatical;
// syncDomain fails loudly if a new Inkeep mention slips through.
const REWRITE = {
  'ask-zilliz': (body) => {
    const roleSection = [
      '## 1. Role: Experience Layer on Top of the Bundled References',
      '',
      '**Bundled references** = data source (capacity specs, limits, pricing structure, feature guides)',
      '**This command** = user experience layer (understanding, guidance, decisions)',
      '',
      '| References give you | You Add                                                                           |',
      '| ------------------- | --------------------------------------------------------------------------------- |',
      '| Raw pricing data    | Contextual recommendation for their use case                                      |',
      '| Feature list        | Fit analysis: "Your multi-tenant SaaS needs partition keys — here’s how"          |',
      '| Technical specs     | Decision framework: "Given your latency needs, Performance > Capacity because..." |',
      '| Error documentation | Root cause + action: "This error means X. Check Y first, then Z."                 |',
      '',
      '### When the references cannot satisfy',
      '',
      '| Situation              | Action                                                        |',
      '| ---------------------- | ------------------------------------------------------------- |',
      '| Feature not documented | Check Preview status → guide to Support                       |',
      '| Complex architecture   | Use your knowledge + the references for best-practice patterns |',
      '| Custom integration     | Generate code from `developer-guide.md` and `api-patterns.md` |',
      '| Edge case              | Provide solution with caveat + Support link                   |',
      '| Custom pricing         | Estimation formula + direct to Sales                          |',
      '| Anything live (current rates, brand-new features) | Say the references may lag and link https://docs.zilliz.com |',
      '',
    ].join('\n');

    return body
      // Replace the whole Inkeep-role section up to the next top-level heading.
      .replace(/## 1\. Role: Experience Layer on Top of Inkeep[\s\S]*?(?=\n## )/, roleSection)
      .replace(/1\. Query Inkeep MCP for current pricing/g, '1. Read `pricing.md` from the bundled references')
      .replace(/\*\*MUST query Inkeep\*\*/g, '**MUST read `pricing.md`**')
      .replace(/When uncertain, query Inkeep first/g, 'When uncertain, check the bundled references first')
      .replace(/Inkeep or (`references\/[\w-]+\.md`)/g, '$1')
      .replace(/\| Feature availability \| Inkeep +\|/g, '| Feature availability | `cluster-selection.md`, `enterprise-features.md` |')
      .replace(/Inkeep → docs/g, 'https://docs.zilliz.com')
      .replace(/verify rates with Inkeep/g, 'verify rates against `pricing.md` and the live calculator')
      .replace(/query Inkeep for current vCU price/g, 'see `pricing.md` for the vCU price')
      .replace(/\*\*Inkeep MCP\*\* → documentation search/g, '**Bundled references** → then https://docs.zilliz.com')
      .replace(/did I query Inkeep and add disclaimer\?/g, 'did I read `pricing.md` and add the disclaimer?')
      .replace(/^(#+ .*)Inkeep(.*)$/gm, '$1the bundled references$2');
  },
};

// Human-readable subject for the prompt's opening line.
const SUBJECT = {
  'ask-zilliz': 'Zilliz Cloud questions -- plans, pricing, schema design, SDK usage, and troubleshooting',
  'diagnose': 'read-only diagnosis of unhealthy or slow Zilliz clusters and collections',
};

// Slash-command references are only minted for commands this extension actually
// ships (the synced domains plus the hand-maintained onboarding ones); anything
// else stays a prose pointer at upstream rather than a dangling /zilliz: link.
const SHIPPED = [...DOMAINS, 'setup', 'quickstart', 'status'];

// Skill names may be wrapped in backticks or bold in upstream markdown.
const SKILL_REF = /\b(see )?(?:the )?[`*_]{0,2}([a-z][\w-]*)[`*_]{0,2} skill\b/gi;

// Translate Claude-specific phrasing so the prompt reads natively in Gemini CLI.
function neutralize(body) {
  return body
    .replace(/\bClaude Code\b/g, 'Gemini CLI')
    .replace(/\bClaude CLI\b/g, 'Gemini CLI')
    .replace(/\bClaude\b/g, 'the assistant')
    // Single pass, so a rewritten reference is never rewritten again.
    .replace(SKILL_REF, (_m, see, name) => {
      if (SHIPPED.includes(name.toLowerCase())) {
        const cmd = commandName(name.toLowerCase());
        return see ? `run \`/zilliz:${cmd}\`` : `\`/zilliz:${cmd}\``;
      }
      return `${see || ''}the \`${name}\` skill in the upstream zilliz plugin`;
    });
}

// The TOML description is a single /help line; keep the first paragraph of a
// multi-line frontmatter description and collapse its whitespace.
function oneLine(text) {
  return text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
}

// Bundled files are read at runtime, so the prompt resolves the installed
// extension's directory instead of hardcoding an install path.
function assetPreamble(domain, names) {
  if (!names.length) return [];
  const rel = `references/${commandName(domain)}`;
  // Extensions install either as a copy under ~/.gemini/extensions/<name>/ or as a
  // "link" whose directory holds only .gemini-extension-install.json pointing at the
  // source checkout -- resolve both. No braces inside: !{} ends at the first `}`.
  const probe =
    `!{d=""; for c in "$HOME/.gemini/extensions/zilliz" "./.gemini/extensions/zilliz"; do ` +
    `[ -d "$c/${rel}" ] && d="$c/${rel}" && break; ` +
    `s=$(sed -n 's/.*"source" *: *"\\([^"]*\\)".*/\\1/p' "$c/.gemini-extension-install.json" 2>/dev/null); ` +
    `[ -n "$s" ] && [ -d "$s/${rel}" ] && d="$s/${rel}" && break; done; ` +
    `[ -n "$d" ] && echo "$d" || ` +
    `echo "(bundled references not found -- fall back to https://docs.zilliz.com)"}`;
  return [
    '',
    '## Reference material',
    '',
    'Reference files ship with this extension in the directory below. Read the ones',
    'relevant to the question with your file-reading tool before answering; do not',
    'guess at figures they cover.',
    '',
    probe,
    '',
    `Available files: ${names.join(', ')}`,
    '',
    '---',
  ];
}

function renderToml(domain, description, body, assetNames = []) {
  const cmds = helpCmds(domain);
  const opening = SUBJECT[domain]
    ? `You are helping the user with ${SUBJECT[domain]}.`
    : `You are helping the user with Zilliz ${domain} operations via \`zilliz-cli\`.`;

  const liveHelp = cmds.length
    ? [
        '',
        '## Live help',
        '',
        ...cmds.map(
          (c) =>
            `!{zilliz ${c} --help 2>/dev/null || echo "zilliz-cli not installed — run /zilliz:setup first"}`,
        ),
      ]
    : [];

  const prompt = [
    opening,
    ...assetPreamble(domain, assetNames),
    '',
    body.trim(),
    ...liveHelp,
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

async function listUpstreamDir(path) {
  const r = await fetch(
    `https://api.github.com/repos/${UPSTREAM}/contents/${path}?ref=${BRANCH}`,
    { headers: ghHeaders },
  );
  if (!r.ok) return null; // rate-limited or moved; caller falls back
  const arr = await r.json();
  return Array.isArray(arr) ? arr.filter((e) => e.type === 'file').map((e) => e.name) : null;
}

// Copy a skill's bundled reference files into references/<domain>/.
async function syncAssets(domain) {
  const sub = ASSET_DIRS[domain];
  if (!sub) return { names: [], changed: [] };

  const upstreamDir = `${SOURCE_PREFIX}/${domain}/${sub}`;
  const outDir = assetOutDir(domain);
  let names = await listUpstreamDir(upstreamDir);
  if (!names) {
    // Could not list upstream (usually a rate limit): refresh what we already
    // have rather than silently dropping files.
    names = existsSync(outDir) ? (await readdir(outDir)).filter((n) => n.endsWith('.md')) : [];
    if (!names.length) {
      throw new Error(
        `cannot list ${upstreamDir} and no local copy exists — the prompt would point at missing files. ` +
          'Usually a GitHub API rate limit: rerun with GITHUB_TOKEN set.',
      );
    }
    console.warn(`\n  ${domain}: upstream listing unavailable, refreshing ${names.length} known assets`);
  }

  const changed = [];
  if (MODE === 'write' && names.length) await mkdir(outDir, { recursive: true });
  for (const name of names.sort()) {
    const text = await fetchText(`${upstreamDir}/${name}`);
    const outPath = join(outDir, name);
    const current = existsSync(outPath) ? await readFile(outPath, 'utf8') : '';
    if (current === text) continue;
    changed.push(name);
    if (MODE === 'write') await writeFile(outPath, text);
  }
  return { names: names.sort(), changed };
}

async function syncDomain(domain) {
  const source = `${SOURCE_PREFIX}/${domain}/SKILL.md`;
  const [md, sha] = await Promise.all([fetchText(source), fetchLatestSha(source)]);
  const { fm, body } = stripFrontmatter(md);
  const assets = await syncAssets(domain);
  const description = oneLine(neutralize(fm.description || `Zilliz ${domain} operations.`));
  const rewrite = REWRITE[domain] ?? ((b) => b);
  const rewritten = rewrite(neutralize(body));
  if (REWRITE[domain] && /Inkeep/.test(rewritten)) {
    const lines = rewritten.split('\n').filter((l) => l.includes('Inkeep'));
    throw new Error(`unrewritten Inkeep reference(s):\n    ${lines.join('\n    ')}`);
  }
  const toml = renderToml(domain, description, rewritten, assets.names);

  const outPath = join(OUT_DIR, `${commandName(domain)}.toml`);
  const current = existsSync(outPath) ? await readFile(outPath, 'utf8') : '';
  const changed = current !== toml;

  if (MODE === 'write' && changed) await writeFile(outPath, toml);
  return { domain, source, sha, changed: changed || assets.changed.length > 0, outPath };
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
      state.files[r.domain] = {
        source: r.source,
        command: commandName(r.domain),
        sha: r.sha,
      };
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
