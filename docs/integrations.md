# Optional integrations and benchmarks

## AST parser (JavaScript/TypeScript)

Install `typescript` separately and call:

```js
import {extractTypeScript} from 'repo-knowledge-graph/adapters';
console.log(await extractTypeScript('export function greet() {}', 'example.ts'));
```

This is an AST extraction helper, not yet wired into the default scanner.

## Laya-compatible local decision endpoint

If you serve Laya behind an OpenAI-compatible chat-completions API:

```js
import {createDecisionAdapter} from 'repo-knowledge-graph/adapters';
import {routeTask} from 'repo-knowledge-graph';
const decide=createDecisionAdapter({endpoint:'http://localhost:8000/v1/chat/completions',model:'laya'});
const selection=await routeTask('summarize this',{decide,models:{small:async q=>q}});
console.log(await selection.execute());
```

This is an **API compatibility adapter**, not a bundled Laya runtime or verified native integration. Default host allowlist is loopback-only; explicitly review any host override.

## Graphify

`transformGraph(graph,{transform})` accepts a caller-provided Graphify-compatible transformation function. No native Graphify API integration is claimed.

## Retrieval evaluation

```js
import {benchmark} from 'repo-knowledge-graph/benchmark';
import {searchFiles} from 'repo-knowledge-graph';
const report=await benchmark(graph,[{query:'authentication',relevantPaths:['src/auth.ts']}],{
 retrieve:searchFiles
});
console.log(report);
```

Reports precision@K, recall@K, approximate selected tokens, and retrieval latency. To measure real tokens, supply a model tokenizer and retrieval outputs with content. No claims about model quality or real-world cost savings are made.
