import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const skip=new Set(['.git','node_modules','dist','build','.repo-graph','coverage','.venv']);
const extensions=new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.py','.go','.java','.rs','.md','.json']);
export const estimateTokens=text=>Math.ceil(String(text).length/4);
export async function scan(root,{maxBytes=256000}={}){
 root=path.resolve(root);const nodes=[],edges=[],files=[];
 async function walk(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
   if(item.isSymbolicLink()||skip.has(item.name))continue;
   const full=path.join(dir,item.name);
   if(item.isDirectory()){await walk(full);continue;}
   if(!item.isFile()||!extensions.has(path.extname(item.name)))continue;
   let content;try{content=await readFile(full,'utf8');}catch{continue;}
   if(Buffer.byteLength(content)>maxBytes||content.includes('\0'))continue;
   const rel=path.relative(root,full).split(path.sep).join('/'),id='file:'+rel;
   nodes.push({id,type:'file',name:rel});files.push({path:rel,content});
   for(const m of content.matchAll(/(?:import\s+(?:[^'"]+?\s+from\s+)?|require\s*\(|from\s+)['"]([^'"]+)['"]/g))
    edges.push({from:id,to:'module:'+m[1],type:'imports'});
   for(const m of content.matchAll(/\b(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|def)\s+([A-Za-z_$][\w$]*)/g)){
    const sid='symbol:'+rel+':'+m[1];nodes.push({id:sid,type:'symbol',name:m[1],file:rel});edges.push({from:id,to:sid,type:'contains'});
   }
  }
 }
 await walk(root);
 for(const e of edges.filter(e=>e.to.startsWith('module:')))
  if(!nodes.some(n=>n.id===e.to))nodes.push({id:e.to,type:'module',name:e.to.slice(7)});
 return {schemaVersion:1,root,generatedAt:new Date().toISOString(),nodes,edges,files};
}
export function search(graph,query,{limit=10}={}){
 const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];
 return graph.files.map(f=>{const name=f.path.toLowerCase(),body=f.content.toLowerCase();
 const score=terms.reduce((n,t)=>n+(name.includes(t)?5:0)+(body.includes(t)?1:0),0);
 return {path:f.path,score,content:f.content};}).filter(f=>f.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,limit);
}
export function context(graph,query,{limit=5,maxTokens=4000}={}){
 let used=0;const selected=[];
 for(const f of search(graph,query,{limit:graph.files.length})){
  if(selected.length>=limit)break;const cost=estimateTokens(f.content);
  if(used+cost>maxTokens)continue;
  selected.push({path:f.path,content:f.content,estimatedTokens:cost});used+=cost;
 }
 const baseline=graph.files.reduce((n,f)=>n+estimateTokens(f.content),0);
 return {query,selected,estimatedContextTokens:used,estimatedBaselineTokens:baseline,estimatedTokensSaved:Math.max(0,baseline-used),estimatedSavingsPercent:baseline?Math.round((baseline-used)/baseline*100):0,method:'characters/4 heuristic, not billed tokens'};
}
export async function save(graph,root=graph.root){
 const dir=path.join(root,'.repo-graph');await mkdir(dir,{recursive:true});
 const target=path.join(dir,'graph.json');await writeFile(target,JSON.stringify(graph,null,2));return target;
}
export async function load(root){return JSON.parse(await readFile(path.join(path.resolve(root),'.repo-graph','graph.json'),'utf8'));}
