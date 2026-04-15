# Zilliz Cloud Extension for Gemini CLI

This extension lets Gemini CLI drive **Zilliz Cloud** and **Milvus** by executing
`zilliz-cli` commands on your behalf. Gemini will construct and run the appropriate
CLI commands; you review and approve before any destructive action.

---

## 1. Purpose & Scope

Use this extension to manage every layer of Zilliz Cloud from the terminal:
clusters, databases, collections, partitions, indexes, vectors, imports, backups,
users/roles, monitoring, projects/regions, and billing. Gemini will translate
natural-language requests into `zilliz-cli` invocations.

---

## 2. Prerequisites

`zilliz-cli` must be on `$PATH`. Quick check:

```bash
!{which zilliz-cli || echo "MISSING — run /zilliz:setup to install"}
```

**Install (macOS / Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/zilliztech/zilliz-cli/master/install.sh | bash
```

**Install (Windows PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/zilliztech/zilliz-cli/master/install.ps1 | iex
```

If `zilliz-cli` is missing, run `/zilliz:setup` before anything else.

---

## 3. Auth & Context Model

| Task | Command |
|------|---------|
| Browser login (recommended, full access) | `zilliz login` |
| API Key login | `zilliz login --api-key` |
| Legacy configure | `zilliz configure` |
| Check auth status | `zilliz auth status` |
| Show active cluster | `zilliz context current` |
| Switch cluster | `zilliz context set --cluster-id <id>` |
| Switch database | `zilliz context set --database <db-name>` |

**Never echo or log API keys or tokens.** Interactive login commands (`zilliz login`)
must be run by the user in their own terminal — Gemini cannot complete interactive flows.

---

## 4. Safety Rules

Before executing any of the following, **always show the exact command and ask the
user to confirm**:

- `zilliz cluster delete` — irreversible
- `zilliz collection drop` — deletes all data in the collection
- `zilliz database drop` — deletes all collections in the database
- `zilliz backup delete` — irreversible
- `zilliz user drop` / `zilliz role drop`
- `zilliz partition drop`
- `zilliz volume delete`
- Any command with `--force`

Asynchronous operations (`cluster create`, `backup create`, `import start`,
`backup restore-cluster`) must be polled with the appropriate `describe`/`status`
command until completion before reporting success.

---

## 5. Command Group Cheat Sheet

| Group | Intent | Sample |
|-------|--------|--------|
| **cluster** | Create, list, describe, suspend, resume, delete clusters | `zilliz cluster list` |
| **database** | Create, list, describe, drop databases (Dedicated only) | `zilliz database list` |
| **collection** | Create, list, describe, drop, load, release collections & aliases | `zilliz collection list` |
| **partition** | Create, list, load, release, drop partitions | `zilliz partition list --collection <name>` |
| **index** | Create, list, describe, drop indexes | `zilliz index list --collection <name>` |
| **vector** | Insert, upsert, search, hybrid-search, query, get, delete vectors | `zilliz vector search --collection <name> --data '[[...]]'` |
| **import** | Start, list, check status of bulk import jobs | `zilliz import list --cluster-id <id>` |
| **backup** | Create, list, describe, delete, export, restore backups & policies | `zilliz backup list` |
| **user-role** | Manage users, roles, passwords, privileges (Dedicated only) | `zilliz user list` |
| **monitoring** | Cluster status, collection stats, time-series metrics | `zilliz cluster describe --cluster-id <id>` |
| **project-region** | Manage projects, cloud providers, regions, storage volumes | `zilliz project list` |
| **billing** | Check usage, list invoices, view invoice details (OAuth only) | `zilliz billing usage --last 7d` |

---

## 6. Output Handling

- Prefer `--output json` when you need to parse results programmatically or
  display structured summaries.
- For human-readable tables, omit `--output json` and show the raw CLI output.
- When the user asks for a "status overview", collect JSON output from multiple
  commands and format it into a readable summary table.
- Never truncate error output — always surface the full error message.

---

## 7. Available Slash Commands

| Command | Description |
|---------|-------------|
| `/zilliz:setup` | Install zilliz-cli and walk through auth & context bootstrap |
| `/zilliz:quickstart` | End-to-end onboarding: install → login → cluster → context |
| `/zilliz:status` | Comprehensive overview: context, cluster, databases, collections |
| `/zilliz:cluster` | Cluster lifecycle operations |
| `/zilliz:database` | Database management |
| `/zilliz:collection` | Collection & alias management |
| `/zilliz:partition` | Partition management |
| `/zilliz:index` | Index management |
| `/zilliz:vector` | Vector insert, search, query, delete |
| `/zilliz:import` | Bulk data import jobs |
| `/zilliz:backup` | Backup & restore operations |
| `/zilliz:user-role` | User, role & privilege management |
| `/zilliz:monitoring` | Metrics, stats, and load states |
| `/zilliz:project-region` | Projects and storage volumes |
| `/zilliz:billing` | Usage and invoice management |

Type a slash command followed by your request, e.g.:
`/zilliz:cluster create a free-tier cluster in AWS us-east-1`
