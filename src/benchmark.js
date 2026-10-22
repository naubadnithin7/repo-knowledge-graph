import {performance} from 'node:perf_hooks';
/** Reproducible context retrieval quality and estimated token benchmark. */
export async function benchmark(graph,cases,{retrieve,tokenizer,limit=5}={}){
 if(!Array.isArray(cases)||!cases.length)throw Error('Provide benchmark cases');
 if(typeof retrieve!=='function')throw Error('Provide retrieve(graph,query)');
 const count=tokenizer||((s)=>Math.ceil(String(s).length/4)),results=[];
 for(const entry of cases){
  if(typeof entry.query!=='string'||!Array.isArray(entry.relevantPaths))throw Error('Case requires query and relevantPaths');
  const start=performance.now(),r=await retrieve(graph,entry.query,{limit}),latencyMs=performance.now()-start;
  const selected=Array.isArray(r)?r:r.selected;if(!Array.isArray(selected))throw Error('Retriever must return array or {selected}');
  const paths=selected.map(x=>x.path),relevant=new Set(entry.relevantPaths),hits=paths.filter(p=>relevant.has(p)).length;
  results.push({query:entry.query,precisionAtK:paths.length?hits/paths.length:0,recallAtK:relevant.size?hits/relevant.size:1,selectedTokens:selected.reduce((n,x)=>n+count(x.content||''),0),latencyMs:Math.round(latencyMs*100)/100,selectedPaths:paths});
 }
 const avg=k=>results.reduce((n,x)=>n+x[k],0)/results.length;
 return {cases:results.length,meanPrecisionAtK:avg('precisionAtK'),meanRecallAtK:avg('recallAtK'),meanSelectedTokens:avg('selectedTokens'),meanLatencyMs:avg('latencyMs'),results,tokenCounting:tokenizer?'provided tokenizer':'characters/4 estimate'};
}
