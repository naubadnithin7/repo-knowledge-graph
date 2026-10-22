# repo-knowledge-graph

Terminal-first, dependency-free Node.js toolkit to index a repository into a simple knowledge graph, search files, select relevant source context, and estimate tokens avoided.

**Status: early alpha, reconstructed Phase 1 foundation.** The original October 21 archive was not accessible; this is a new implementation based on the agreed scope.

## Install

Requires Node.js 20+. Clone and run `npm link` to use the CLI locally. **Not yet published to npm.**

## CLI

Run in the target repository:

```sh
repo-graph index
repo-graph stats
repo-graph search "authentication"
repo-graph context "authentication"
repo-graph savings "authentication"
```

Index data is saved to `.repo-graph/graph.json`. This file contains indexed **full source code** and must not be shared without review.

## API

```js
import {scan,search,context,save} from 'repo-knowledge-graph';
const graph=await scan(process.cwd());
await save(graph);
console.log(search(graph,'payment'));
console.log(context(graph,'payment',{maxTokens:2000}));
```

## Scope and limitations

- Regex-based symbol and import extraction, not a complete AST or resolved dependency graph.
- Lexical search only; no embeddings, Graphify integration, semantic search, or Laya/JEV model routing yet.
- Estimated tokens use characters / 4; savings are *not* measured billed tokens or validated relevance gains.
- No .gitignore parsing, incremental updates, secret detection, or scalable graph database.
- No SPA yet. CLI and exported functions are intended as a foundation for a future local API.

## Roadmap

1. AST parsing and resolved file/symbol dependency edges.
2. Incremental indexing, ignore rules, secret-safe graph persistence.
3. Optional semantic retrieval and Graphify adapter.
4. Reproducible retrieval-quality and actual-token benchmarks.
5. Phase 2: Laya decision-model adapter and model/agent routing.
6. Optional SPA.

## Development

```sh
npm test
npm run check
```

MIT licensed. Contributions welcome.
