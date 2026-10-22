import {performance} from 'node:perf_hooks';
/** Retrieval quality benchmark with optional model tokenizer. */
export async function benchmark(graph,cases,{retrieve,tokenizer,limit=5}={}){
 if(!Array.isArray(cases)||!cases.length||typeof retrieve!=='function')throw Error('Provide cases and retrieve function');
 const count=tokenizer||((s)=>Math.ceil(String(s).length/4)),results=[];
 for(const entry of cases){if(typeof entry.query!=='string'||!Array.isArray(entry.relevantPaths))throw Error('Invalid benchmark case');
 const start=performance.now(),r=await retrieve(graph,entry.query,{limit}),latencyMs=performance.now()-start;
 const selected=Array.isArray(r)?r:r?.selected;if(!Array.isArray(selected))throw Error('Invalid retrieval result');
 const relevant=new Set(entry.relevantPaths),hits=selected.filter(f=>relevant.has(f.path)).length;
 results.push({query:entry.query,precisionAtK:selected.length?hits/selected.length:0,recallAtK:relevant.size?hits/relevant.size:1,selectedTokens:selected.reduce((n,f)=>n+count(f.content||''),0),latencyMs,selectedPaths:selected.map(f=>f.path)});
 }
 const mean=k=>results.reduce((n,r)=>n+r[k],0)/results.length;
 return {cases:results.length,meanPrecisionAtK:mean('precisionAtK'),meanRecallAtK:mean('recallAtK'),meanSelectedTokens:mean('selectedTokens'),meanLatencyMs:mean('latencyMs'),tokenCounting:tokenizer?'supplied tokenizer':'characters/4 estimate',results};
}
