---
name: sync-zilliz-plugin
description: Use when the user asks to sync, update, or check drift of this gemini-cli extension against upstream zilliztech/zilliz-plugin. Triggers on phrases like "同步上游", "sync from zilliz-plugin", "update commands from plugin", "check if plugin upstream changed". Runs scripts/sync.mjs to regenerate commands/zilliz/*.toml from upstream skills/*/SKILL.md.
---

# Sync commands/ from zilliz-plugin upstream

## What this sync does

`commands/zilliz/<domain>.toml` is a Gemini-CLI-native wrapper around the
`plugins/zilliz/skills/<domain>/SKILL.md` content in `zilliztech/zilliz-plugin`
(the path prefix lives in `SOURCE_PREFIX`). The sync script fetches upstream, strips YAML frontmatter, neutralizes Claude-specific
phrasing, wraps the body in the TOML command template (with `!{zilliz <domain>
--help}` injection and safety rules), and writes it back.

## Scope

**In scope (19 domain commands, auto-synced):**
cluster, database, collection, partition, index, vector, import, backup,
user-role, acl, monitoring, project-region, billing, external-collection, job,
on-demand-cluster, privatelink, diagnose, ask-zilliz.

That is every skill upstream ships except the onboarding trio below. If upstream
adds another, references to it render as a prose pointer at upstream (not a
dangling `/zilliz:` link) until it is added to `DOMAINS`.

**Out of scope (hand-maintained, do not auto-sync):**
- `setup.toml` — no upstream source; bootstraps zilliz-cli install + auth.
- `quickstart.toml` / `status.toml` — adapted from `zilliz-plugin/commands/*.md`
  with Gemini-CLI framing changes that a naive sync would clobber.
- `GEMINI.md` — global context; review manually if upstream restructures skills.

If the user wants to resync onboarding commands too, do it manually: diff
against `zilliz-plugin/commands/quickstart.md` / `status.md` and merge by hand.

## Four things the script does that are easy to break

1. **`COMMAND_NAMES`** — the command file, its reference dir, and every
   cross-reference follow this map when the command should not be named after
   the upstream skill (`ask-zilliz` ships as `/zilliz:ask`). `.sync-state.json`
   still keys on the upstream skill name and records the command alongside it.
2. **`HELP_CMDS`** — a skill name is not always a `zilliz` subcommand. `user-role`
   is `zilliz user` + `zilliz role`, `project-region` is `project` + `volume`,
   `monitoring`/`diagnose` are `cluster` + `collection`, and `ask-zilliz` has no
   CLI surface at all (empty list = no `!{}` block). Get this wrong and the
   command silently injects "zilliz-cli not installed" instead of real help.
   Verify with `zilliz <cmd> --help` before adding a mapping.
3. **`ASSET_DIRS`** — `ask-zilliz` ships 14 reference files, copied into
   `references/ask/` (named for the command). The prompt resolves that directory at runtime by
   probing the install location, so the files must actually be committed. The
   script errors out rather than emitting a prompt pointing at a missing dir.
4. **`REWRITE`** — `ask-zilliz` upstream depends on an Inkeep MCP server this
   extension does not ship; its Inkeep directives are rewritten onto the bundled
   references plus https://docs.zilliz.com. A surviving `Inkeep` mention fails
   the sync loudly, so upstream edits to that skill need a rewrite rule, not a
   silent pass-through.

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

Requires Node 18+ (uses built-in `fetch`). A full run makes ~20 GitHub API calls,
which blows the 60/hour unauthenticated limit in three runs — pass
`GITHUB_TOKEN=$(gh auth token)` for anything more than a one-off.

## Recommended workflow

1. Run `node scripts/sync.mjs` from the repo root.
2. `git diff commands/zilliz/` — review each changed TOML. Look for:
   - New command flags or subcommands (desirable).
   - Regressions in the rendered prompt (e.g., broken markdown, orphan references).
   - Any `Claude`-flavored phrasing the neutralizer missed — if found, add a
     rule to the `neutralize()` function in `scripts/sync.mjs`. A cross-skill
     reference only becomes a `/zilliz:` link when the name is in `SHIPPED`.
3. Spot-check that the TOMLs parse (`tomllib` on Python 3.11+, `tomli` below that):
   `python3 -c "import tomli,glob; [tomli.load(open(f,'rb')) for f in glob.glob('commands/zilliz/*.toml')]"`.
4. If upstream added a new skill domain not in the `DOMAINS` array of
   `sync.mjs`, add it there (the script writes the new TOML itself, but it does
   not discover new upstream directories), give it a `HELP_CMDS` entry if the
   name is not a `zilliz` subcommand, and add it to the README and GEMINI.md
   command tables.
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
