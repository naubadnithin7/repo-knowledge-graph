#!/usr/bin/env node
import {scan,save,load,searchFiles,context} from '../src/index.js';
const [command,...args]=process.argv.slice(2),root=process.cwd();
try{
 if(command==='index'){let previous;try{previous=await load(root);}catch{}const g=await scan(root,{previous,parser:process.env.REPO_GRAPH_PARSER||'regex'}),file=await save(g);console.log(JSON.stringify({file,files:g.files.length,nodes:g.nodes.length,edges:g.edges.length,unchangedFiles:g.reusedFiles},null,2));}
 else if(['stats','search','context','savings'].includes(command)){const g=await load(root);if(command==='stats')console.log(JSON.stringify({files:g.files.length,nodes:g.nodes.length,edges:g.edges.length},null,2));else{const query=args.join(' ');if(!query)throw Error('Query required');const r=command==='search'?await searchFiles(g,query):await context(g,query);console.log(JSON.stringify(command==='savings'?{estimatedBaselineTokens:r.estimatedBaselineTokens,estimatedContextTokens:r.estimatedContextTokens,estimatedTokensSaved:r.estimatedTokensSaved,estimatedSavingsPercent:r.estimatedSavingsPercent,method:r.method}:r,null,2));}}
 else{console.log('Usage: repo-graph <index|stats|search|context|savings> [query]');if(command)process.exitCode=1;}
}catch(e){console.error(e.message);process.exitCode=1;}
