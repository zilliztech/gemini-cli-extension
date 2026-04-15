# Contributing

Thanks for your interest in improving the Zilliz extension for Gemini CLI.

## Repository layout

```
gemini-extension.json         Extension manifest (no MCP).
GEMINI.md                     Always-loaded context: prerequisites, safety, cheat sheet.
commands/zilliz/*.toml        Slash commands exposed as /zilliz:<name>.
scripts/sync.mjs              Pulls domain commands from zilliztech/zilliz-plugin.
.sync-state.json              Per-domain upstream commit SHAs (committed).
.geminiignore                 Paths excluded from extension indexing.
.claude/skills/               Claude Code skills used while developing this repo.
```

## Prerequisites

- Node.js 18+ (built-in `fetch` required by `scripts/sync.mjs`).
- `zilliz-cli` on `$PATH` for smoke-testing commands.
- Gemini CLI for local install: `gemini extensions link <path>`.

## Development workflow

### Link the extension locally

```bash
gemini extensions link /absolute/path/to/this/repo
gemini                        # launch REPL
/zilliz:status                # smoke test
```

Changes to TOML and `GEMINI.md` are picked up on the next REPL session.

### Edit a single command

TOML command prompts live in `commands/zilliz/`. Keep edits small and
validate TOML parses:

```bash
python3 -c "import tomllib; tomllib.loads(open('commands/zilliz/<name>.toml','rb').read())"
```

**Important:** the 12 domain commands (cluster, database, collection,
partition, index, vector, import, backup, user-role, monitoring,
project-region, billing) are **generated** from upstream
[`zilliztech/zilliz-plugin`](https://github.com/zilliztech/zilliz-plugin) via
`scripts/sync.mjs`. Hand-edits to those files will be overwritten on the
next sync. If you need a local divergence, edit the template or
`neutralize()` rules in `scripts/sync.mjs` instead.

Hand-maintained (safe to edit directly):

- `commands/zilliz/setup.toml`
- `commands/zilliz/quickstart.toml`
- `commands/zilliz/status.toml`
- `GEMINI.md`

### Sync from upstream

**Recommended: use the Claude Code skill.**

Open this repo in Claude Code and ask naturally — e.g. *"sync from
zilliz-plugin"*, *"同步上游"*, or *"check if the plugin upstream
changed"*. The `sync-zilliz-plugin` skill in
`.claude/skills/sync-zilliz-plugin/SKILL.md` auto-activates and walks
the full loop: run the script, review `git diff`, call out any
regressions the neutralizer missed, update `.sync-state.json`, and
draft a commit message referencing the upstream short SHA. This is the
preferred path because the skill encodes the review checklist that a
bare script invocation skips.

**Manual fallback: invoke the script directly.**

```bash
node scripts/sync.mjs                   # rewrite, update .sync-state.json
node scripts/sync.mjs --check           # CI drift check (exit 1 on drift)
node scripts/sync.mjs --dry-run         # preview
SYNC_BRANCH=master node scripts/sync.mjs
GITHUB_TOKEN=... node scripts/sync.mjs  # avoid 60/hr rate limit
```

Workflow if you go manual:

1. Run the sync.
2. `git diff commands/zilliz/` — review, especially for Claude-specific
   phrasing the `neutralize()` rules missed. If you spot any, add a
   rule in `scripts/sync.mjs` and resync rather than hand-editing the
   TOML.
3. Smoke-test a couple of commands in the Gemini REPL.
4. Commit the TOML changes and `.sync-state.json` together with a
   message referencing the upstream short SHA.

### Adding a new domain

When upstream adds a new skill domain:

1. Add its name to the `DOMAINS` array in `scripts/sync.mjs`.
2. Run `node scripts/sync.mjs`. The new file appears under
   `commands/zilliz/`.
3. Add a one-line entry to the cheat sheet in `GEMINI.md`.

### Adding an onboarding or local-only command

For commands with no upstream counterpart (like `setup`):

1. Create `commands/zilliz/<name>.toml` by hand. Mirror the structure of
   existing `setup.toml`.
2. Leave it out of the `DOMAINS` array — the sync script will not touch
   files it doesn't know about, but adding it there would regenerate it.
3. Add it to the command table in `README.md`.

## Testing

No formal test suite. Before submitting a PR:

- `node scripts/sync.mjs --check` passes (or the PR intentionally
  updates the sync).
- All TOMLs parse (see one-liner above; loop over all files).
- `gemini-extension.json` is valid JSON.
- At least one representative `/zilliz:*` command runs end-to-end in a
  real Gemini CLI session against a real `zilliz-cli` install.

## Commit and PR conventions

- Keep subject lines under ~70 chars; describe the *why* in the body.
- One logical change per commit. Sync commits should be separate from
  feature commits.
- Reference the upstream short SHA in sync commits:
  `chore(sync): pull commands from zilliz-plugin @ abc1234`.

## Reporting issues

Please include:

- Gemini CLI version (`gemini --version`).
- `zilliz-cli` version.
- The `/zilliz:*` command you ran and the full output.
- Expected vs actual behavior.

## License

By contributing, you agree that your contributions will be licensed
under the Apache License 2.0 (see `LICENSE`).
