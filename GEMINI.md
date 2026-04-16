# Zilliz extension for Gemini CLI

Drive Zilliz Cloud from Gemini CLI via the `zilliz` CLI. This file is loaded
as global context on every invocation.

**CLI version:** 1.1.0 (local)

## Purpose

- Create, manage, scale, and suspend/resume Zilliz Cloud clusters.
- Operate on collections, vectors, indexes, partitions, databases, and aliases.
- Import data, manage backups, and administer users and roles.

## Prerequisites

- `zilliz` CLI installed (`curl -fsSL https://zilliz.com/cli/install.sh | bash`).
- Authenticated via `zilliz login` (or `ZILLIZ_API_KEY`).
- Active cluster context: `zilliz context set` / `zilliz context current`.

## Safety

Destructive operations — `cluster delete`, `collection drop`, `backup restore-cluster`,
`user delete`, etc — require explicit user confirmation before execution.

## Command pattern

```
zilliz <resource> <operation> [--flag value ...]
```

All commands accept: `-o/--output` (json|table|text|yaml|csv), `--query` (JMESPath),
`--no-header`. Resource operations also accept: `--api-key` (or `ZILLIZ_API_KEY`),
`-a/--all`, `--wait`.

## Available slash commands

- `/zilliz:cluster` — Create, scale, and manage cloud clusters.
- `/zilliz:project` — Create and manage projects.
- `/zilliz:backup` — Create, restore, and manage backups.
- `/zilliz:import` — Import data from cloud storage.
- `/zilliz:volume` — Manage data volumes.
- `/zilliz:job` — Query status of async Cloud Jobs.
- `/zilliz:billing` — View usage, invoices, and billing information.
- `/zilliz:collection` — Create and manage vector collections.
- `/zilliz:vector` — Search, insert, and query vector data.
- `/zilliz:database` — Create and manage databases.
- `/zilliz:index` — Create and manage vector indexes.
- `/zilliz:partition` — Create and manage collection partitions.
- `/zilliz:user` — Create and manage database users. (Dedicated only)
- `/zilliz:role` — Create and manage access control roles. (Dedicated only)
- `/zilliz:alias` — Create and manage collection aliases.

## Bespoke commands

- `/zilliz:quickstart` — Set up Zilliz Cloud CLI — install, authenticate, and configure your cluster context in one go.
- `/zilliz:setup` — Use when the user needs to install zilliz-cli, log in to Zilliz Cloud, configure credentials, or set the active cluster context.
- `/zilliz:status` — Show a comprehensive overview of the current Zilliz Cloud cluster — context, cluster details, databases, and collections with stats.
