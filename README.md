# repo-knowledge-graph

Early alpha CLI and npm library. Node.js 20+. **Not published to npm.**

```sh
npm install github:naubadnithin7/repo-knowledge-graph
repo-graph index
repo-graph search authentication
repo-graph context authentication
repo-graph savings authentication
```

Incremental symbol parsing reuses unchanged file metadata; files are still read and hashed. Optional TypeScript AST extraction requires `typescript` and `REPO_GRAPH_PARSER=typescript`. Graphify-compatible `toGraphify(graph,{createGraph})` requires a graph object exposing `addNode`/`addEdge`; integration with a specific Graphify release is not verified. Laya-compatible local decision adapter is available but no model is bundled. Token savings are estimates, not billing measurements. See SECURITY.md.
