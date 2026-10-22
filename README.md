# repo-knowledge-graph

[![npm version](https://img.shields.io/npm/v/repo-knowledge-graph?label=npm)](https://www.npmjs.com/package/repo-knowledge-graph)
[![npm alpha](https://img.shields.io/npm/v/repo-knowledge-graph/alpha?label=alpha)](https://www.npmjs.com/package/repo-knowledge-graph)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Turn a source-code repository into a searchable knowledge graph — directly from your terminal.**

A lightweight Node.js CLI and library for indexing repository files and code symbols, finding relevant code, assembling focused context, and estimating potential token savings. No hosted service or LLM key required for the core workflow.

> **Alpha:** APIs, graph format, and commands may change. Token savings are estimates, not measured API billing reductions.

## Quick start

**Requirements:** Node.js 20+.

From the root of the repository you want to analyze:

```bash
npm install --save-dev repo-knowledge-graph@alpha
npx repo-graph --help
npx repo-graph index
```

The CLI stores its generated graph in `.repo-graph/graph.json` in the current working directory.

## CLI showcase

| Command | What it does |
| --- | --- |
| `npx repo-graph --help` | Show available commands |
| `npx repo-graph index` | Scan the current repository and build/update the graph |
| `npx repo-graph stats` | Display counts of indexed files, nodes, and edges |
| `npx repo-graph search "embedding"` | Find repository files relevant to a query |
| `npx repo-graph context "embedding"` | Retrieve focused context for a query |
| `npx repo-graph savings "embedding"` | Estimate token savings for a query |
| `npx repo-graph index` | Run again to reuse unchanged file metadata |

**Try the complete workflow:**

```bash
# 1. Generate or refresh the knowledge graph
npx repo-graph index

# 2. Inspect the graph
npx repo-graph stats

# 3. Search for a concept in your code
npx repo-graph search "authentication"

# 4. Collect context for that concept
npx repo-graph context "authentication"

# 5. Inspect approximate token savings
npx repo-graph savings "authentication"

# 6. Re-index after making changes
npx repo-graph index
```

**Important:** `search`, `context`, and `savings` each require a query. Run `index` before using them. Commands operate on the **current working directory**, so run them from the project you want to analyze.

### Example: indexing a real repository

The following is an **example from an initial run** on a separate development repository, not a performance benchmark or guaranteed result:

```text
$ npx repo-graph index
{
  "file": "/path/to/llm_engineering/.repo-graph/graph.json",
  "files": 2173,
  "nodes": 11192,
  "edges": 9025,
  "reusedFiles": 0
}
```

`reusedFiles: 0` is expected on a first scan. Re-running `index` can reuse unchanged file metadata; files are still read and hashed for change detection.

### Understanding the commands

- **Index:** Collects repository file and symbol information and creates graph relationships.
- **Stats:** Reports graph size; it does not measure graph quality.
- **Search:** Finds relevant files using the package's current non-LLM search implementation.
- **Context:** Builds a focused context response around the supplied query.
- **Savings:** Reports *estimated* token savings associated with focused context. This is not a measured reduction in actual model usage or cost.

## Using it in CI or scripts

Install it as a project dependency and invoke the binary from the repository root:

```bash
npm install --save-dev repo-knowledge-graph@alpha
npx repo-graph index
npx repo-graph stats
```

To run it without adding a dependency:

```bash
npm exec --yes --package=repo-knowledge-graph@alpha -- repo-graph index
```

The **npm package name** is `repo-knowledge-graph`; the **CLI executable** is `repo-graph`. `alpha` is a release tag, not part of the package name.

## Advanced / experimental integrations

- **Incremental indexing:** Reuses metadata for unchanged files on subsequent scans.
- **Optional TypeScript AST extraction:** Install the optional `typescript` peer dependency and set `REPO_GRAPH_PARSER=typescript` when indexing.
- **Graphify-compatible adapter:** `toGraphify(graph, { createGraph })` expects a graph object with `addNode` and `addEdge`. Compatibility with a particular Graphify release has not been verified.
- **Decision-model integration:** A Laya-compatible local adapter is included as an experimental extension point; no model is bundled.

## Safety and limitations

Review [SECURITY.md](SECURITY.md) before scanning sensitive repositories. Keep `.repo-graph/` out of version control if the generated graph may contain internal repository details:

```gitignore
.repo-graph/
```

The CLI runs locally, but graph outputs may reflect private code structure. The current release is an alpha and should be evaluated on representative repositories before production adoption.

## License

MIT — see [LICENSE](LICENSE).
