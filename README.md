# zilliz — Gemini CLI Extension

Drive **Zilliz Cloud** and **Milvus** from [Gemini CLI](https://github.com/google-gemini/gemini-cli)
using `zilliz-cli` commands. No MCP server required.

## What it does

- Translates natural-language requests into `zilliz-cli` commands
- Covers all major Zilliz Cloud operations: clusters, databases, collections,
  partitions, indexes, vectors, imports, backups, users/roles, monitoring,
  projects, and billing
- Embeds live `--help` output at invocation time so the assistant always has
  up-to-date flag information
- Requires explicit user confirmation before any destructive operation

## Install

```bash
gemini extensions install https://github.com/zilliztech/gemini-cli-extension
```

Or link a local clone for development:

```bash
gemini extensions link /path/to/gemini-cli-extension
```

## Requirements

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- [zilliz-cli](https://github.com/zilliztech/zilliz-cli) on `$PATH`

If `zilliz-cli` is not installed, run `/zilliz:setup` after installing the extension.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/zilliz:setup` | Install zilliz-cli, authenticate, and set cluster context |
| `/zilliz:quickstart` | Full onboarding walkthrough |
| `/zilliz:status` | Overview of current context, cluster, databases, and collections |
| `/zilliz:cluster` | Cluster lifecycle (create, list, suspend, resume, delete) |
| `/zilliz:database` | Database management |
| `/zilliz:collection` | Collection and alias management |
| `/zilliz:partition` | Partition management |
| `/zilliz:index` | Index management |
| `/zilliz:vector` | Vector insert, search, query, get, delete |
| `/zilliz:import` | Bulk data import jobs |
| `/zilliz:backup` | Backup, restore, and policy management |
| `/zilliz:user-role` | Users, roles, and privilege management |
| `/zilliz:monitoring` | Cluster and collection metrics |
| `/zilliz:project-region` | Projects and storage volumes |
| `/zilliz:billing` | Usage and invoice management |

## Usage examples

```
/zilliz:quickstart
/zilliz:cluster create a free cluster in AWS us-east-1
/zilliz:status
/zilliz:vector search my_collection for vectors similar to [0.1, 0.2, 0.3]
/zilliz:backup create a backup of cluster in-123456
```

## Documentation

- [zilliz-cli docs](https://github.com/zilliztech/zilliz-cli)
- [Zilliz Cloud docs](https://docs.zilliz.com)
- [Gemini CLI extension docs](https://geminicli.com/docs/extensions/writing-extensions/)

## License

Apache-2.0 — Copyright 2024 Zilliz
