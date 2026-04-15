---
name: sync-zilliz-plugin
description: Use when the user asks to sync, update, or check drift of this gemini-cli extension against upstream zilliztech/zilliz-plugin. Triggers on phrases like "同步上游", "sync from zilliz-plugin", "update commands from plugin", "check if plugin upstream changed". Runs scripts/sync.mjs to regenerate commands/zilliz/*.toml from upstream skills/*/SKILL.md.
---

# Sync commands/ from zilliz-plugin upstream

## What this sync does

`commands/zilliz/<domain>.toml` is a Gemini-CLI-native wrapper around the
`skills/<domain>/SKILL.md` content in `zilliztech/zilliz-plugin`. The sync
script fetches upstream, strips YAML frontmatter, neutralizes Claude-specific
phrasing, wraps the body in the TOML command template (with `!{zilliz <domain>
--help}` injection and safety rules), and writes it back.

## Scope

**In scope (12 domain commands, auto-synced):**
cluster, database, collection, partition, index, vector, import, backup,
user-role, monitoring, project-region, billing.

**Out of scope (hand-maintained, do not auto-sync):**
- `setup.toml` — no upstream source; bootstraps zilliz-cli install + auth.
- `quickstart.toml` / `status.toml` — adapted from `zilliz-plugin/commands/*.md`
  with Gemini-CLI framing changes that a naive sync would clobber.
- `GEMINI.md` — global context; review manually if upstream restructures skills.

If the user wants to resync onboarding commands too, do it manually: diff
against `zilliz-plugin/commands/quickstart.md` / `status.md` and merge by hand.

## How to run

```bash
# Rewrite TOMLs in place, update .sync-state.json
node scripts/sync.mjs

# Report drift without writing (CI-friendly; exit 1 if any drift)
node scripts/sync.mjs --check

# Show what would change without writing
node scripts/sync.mjs --dry-run

# Sync from a different branch (default: main)
SYNC_BRANCH=master node scripts/sync.mjs

# Avoid GitHub API rate limits
GITHUB_TOKEN=ghp_... node scripts/sync.mjs
```

Requires Node 18+ (uses built-in `fetch`).

## Recommended workflow

1. Run `node scripts/sync.mjs` from the repo root.
2. `git diff commands/zilliz/` — review each changed TOML. Look for:
   - New command flags or subcommands (desirable).
   - Regressions in the rendered prompt (e.g., broken markdown, orphan references).
   - Any `Claude`-flavored phrasing the neutralizer missed — if found, add a
     rule to the `neutralize()` function in `scripts/sync.mjs`.
3. Spot-check one TOML parses: `python3 -c "import tomllib; tomllib.loads(open('commands/zilliz/cluster.toml','rb').read())"`.
4. If upstream added a new skill domain not in the `DOMAINS` array of
   `sync.mjs`, add it there AND create a stub local file (the script only
   rewrites, it doesn't detect new directories automatically).
5. Commit: `git commit -m "chore(sync): pull from zilliz-plugin @ <short-sha>"`.
   The short SHA for each file is in `.sync-state.json`.

## When upstream frontmatter description changes

The TOML `description = "..."` line (shown in `/help` inside Gemini CLI) is
pulled from the SKILL.md YAML frontmatter. If upstream rewords a description,
the sync picks it up automatically — no special action needed.

## When to skip a domain

If you have intentional local divergence for one command (e.g., hand-tuned
prompt), the cleanest path is to temporarily remove that domain from the
`DOMAINS` array in `scripts/sync.mjs`, add a comment explaining why, and
resync the others. Avoid editing the generated TOML directly — the next sync
will overwrite it.

## State file

`.sync-state.json` records, per domain: the upstream source path and the SHA
of the most recent commit touching that file. Useful for:
- Quick answer to "which upstream commit are we on for `vector`?"
- Detecting rebases / force-pushes on the upstream branch.

Commit this file along with the TOML changes.
