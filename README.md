# repo-knowledge-graph

Open-source terminal-first repository knowledge graph and context selection library. **v0.2 alpha**.

## Install

Requires Node.js 20+. Until npm publication:

```sh
npm install --save-dev github:naubadnithin7/repo-knowledge-graph
```

## CLI

Run in your project's root:

```sh
npx repo-graph index
npx repo-graph stats
npx repo-graph search "authentication"
npx repo-graph context "authentication"
npx repo-graph savings "authentication"
```

Add `.repo-graph/` to your project's `.gitignore`. Graph metadata does not persist source contents. Context commands still read local source and may output sensitive content.

## API

```js
import {scan,save,searchFiles,context,semanticSearch,routeTask} from 'repo-knowledge-graph';
const graph=await scan(process.cwd());
await save(graph);
console.log(await searchFiles(graph,'payment'));
console.log(await context(graph,'payment',{maxTokens:2000}));
const matches=await semanticSearch(graph,'payments',{embed:async text=>yourEmbeddingFunction(text)});
const route=await routeTask('summarize PR',{decide:async()=>({kind:'model',name:'small'}),models:{small:async task=>task}});
console.log(await route.execute());
```

## Implemented

- Local file and regex-derived symbol graph; basic relative-import resolution.
- Common `.gitignore` patterns (not full Git semantics).
- Hash-based unchanged-file reporting (files are still read and parsed).
- Lexical retrieval; optional cosine semantic retrieval through a caller-supplied embedding adapter.
- Pluggable async model/agent decision routing through a caller-supplied adapter; **Laya not bundled**.
- Approximate token savings (characters / 4) versus all indexed files; **not measured billing savings**.

## Limitations / roadmap

Regex parsing is not AST-complete; no Graphify adapter, native Laya integration, true incremental parsing, full ignore-rule support, secrets scanning, production benchmarks, SPA, or npm publication yet. Graph metadata includes filenames and hashes; source is read in memory, and context/embedding adapters may disclose it. Review before use with private code.

Next: AST parsing, stronger ignore rules and secrets controls, measured token benchmarks and retrieval-quality evaluation, Graphify adapter, native Laya routing integration, npm publication.

## Development

```sh
npm test
npm run check
npm pack --dry-run
```

MIT licensed; contributions welcome.
