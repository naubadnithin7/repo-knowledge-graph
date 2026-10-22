import {readdir,readFile,mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extractTypeScript} from './adapters.js';
const skip=new Set(['.git','node_modules','dist','build','.repo-graph','coverage','.venv','.venv312','.tox','.mypy_cache','.pytest_cache','__pycache__','.next','vendor']);
const ext=new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.py','.go','.java','.rs','.md','.json']);
const sensitive=/(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|[^/]*\.(?:pem|key|p12)|credentials(?:\..*)?|secrets?(?:\..*)?)$/i;
const norm=p=>p.split(path.sep).join('/');
const secretPattern=/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}))/;
export const estimateTokens=s=>Math.ceil(String(s).length/4);
async function patterns(root){try{return (await readFile(path.join(root,'.gitignore'),'utf8')).split(/\r?\n/).map(p=>p.trim()).filter(p=>p&&!p.startsWith('#'));}catch{return [];}}
function globRegex(glob){let out='';for(let i=0;i<glob.length;i++){const c=glob[i];if(c==='*'){if(glob[i+1]==='*'){i++;if(glob[i+1]==='/'){i++;out+='(?:.*/)?';}else out+='.*';}else out+='[^/]*';}else if(c==='?')out+='[^/]';else out+=('.+^$()[]{}|\\'.includes(c)?'\\':'')+c;}return out;}
function ignored(rel,ps){let matched=false;for(let p of ps){const negate=p.startsWith('!');if(negate)p=p.slice(1);const anchored=p.startsWith('/');if(anchored)p=p.slice(1);const directory=p.endsWith('/');if(directory)p=p.slice(0,-1);const pattern=globRegex(p);const prefix=anchored||p.includes('/')?'^':'^(?:.*/)?';const regex=new RegExp(prefix+pattern+'(?:/.*)?'+String.fromCharCode(36));if(regex.test(rel))matched=!negate;}return matched;}
function resolve(spec,rel,known){if(!spec.startsWith('.'))return 'module:'+spec;const base=norm(path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec)));return 'file:'+([base,base+'.js',base+'.ts',base+'.tsx',base+'.jsx',base+'/index.js',base+'/index.ts'].find(p=>known.has(p))||'__missing__')==='file:__missing__'?'module:'+spec:'file:'+([base,base+'.js',base+'.ts',base+'.tsx',base+'.jsx',base+'/index.js',base+'/index.ts'].find(p=>known.has(p)));}
export async function scan(root,{maxBytes=256000,previous=null,parser='regex'}={}){
 if(!['regex','typescript'].includes(parser))throw Error('Unknown parser');
 root=path.resolve(root);const ps=await patterns(root),files=[],nodes=[],edges=[],contents=new Map(),prior=new Map((previous?.files||[]).map(f=>[f.path,f]));let reusedFiles=0;
 async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){if(ent.isSymbolicLink()||skip.has(ent.name)||ent.name.startsWith('.venv'))continue;const full=path.join(dir,ent.name),rel=norm(path.relative(root,full));if(ignored(rel,ps)||sensitive.test(rel))continue;if(ent.isDirectory()){await walk(full);continue;}if(!ent.isFile()||!ext.has(path.extname(ent.name)))continue;let content;try{content=await readFile(full,'utf8');}catch{continue;}const bytes=Buffer.byteLength(content);if(bytes>maxBytes||content.includes('\0')||secretPattern.test(content))continue;const hash=createHash('sha256').update(content).digest('hex');if(prior.get(rel)?.hash===hash)reusedFiles++;files.push({path:rel,hash,bytes});contents.set(rel,content);}}
 await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));const known=new Set(files.map(f=>f.path));
 for(const f of files){const content=contents.get(f.path),id='file:'+f.path;nodes.push({id,type:'file',name:f.path,hash:f.hash});let symbols=[],imports=[];const old=prior.get(f.path);
 if(old?.hash===f.hash&&previous?.parser===parser&&Array.isArray(old.symbols)&&Array.isArray(old.imports)){symbols=old.symbols;imports=old.imports;}
 else if(parser==='typescript'&&/\.[cm]?[jt]sx?$/.test(f.path)){const ast=await extractTypeScript(content,f.path);symbols=ast.symbols;imports=ast.imports;}
 else{symbols=[...content.matchAll(/\b(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|def)\s+([A-Za-z_$][\w$]*)/g)].map(m=>({name:m[1]}));imports=[...content.matchAll(/(?:import\s+(?:[^'"]+?\s+from\s+)?|require\s*\(|from\s+)['"]([^'"]+)['"]/g)].map(m=>m[1]);}
 f.symbols=symbols;f.imports=imports;
 for(const s of symbols){const sid='symbol:'+f.path+':'+s.name;nodes.push({id:sid,type:'symbol',name:s.name,file:f.path,...(s.line?{line:s.line}:{})});edges.push({from:id,to:sid,type:'contains'});}
 for(const spec of imports)edges.push({from:id,to:resolve(spec,f.path,known),type:'imports'});
 }
 for(const e of edges.filter(e=>e.to.startsWith('module:')))if(!nodes.some(n=>n.id===e.to))nodes.push({id:e.to,type:'module',name:e.to.slice(7)});
 return {schemaVersion:4,root,generatedAt:new Date().toISOString(),nodes,edges,files,reusedFiles,parser};
}
export async function readContextFile(graph,rel){const root=path.resolve(graph.root),file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!graph.files.some(f=>f.path===rel))throw Error('Unsafe or unindexed file');const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe file type');const actual=await realpath(file),realRoot=await realpath(root);if(!actual.startsWith(realRoot+path.sep))throw Error('File escaped repository');const content=await readFile(actual,'utf8');if(secretPattern.test(content))throw Error('Potential secret detected');return content;}
export async function searchFiles(graph,query,{limit=10}={}){const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];const found=[];for(const f of graph.files){const body=(await readContextFile(graph,f.path)).toLowerCase(),name=f.path.toLowerCase(),symbols=(f.symbols||[]).map(s=>s.name.toLowerCase()),score=terms.reduce((n,t)=>n+(name.includes(t)?5:0)+(symbols.some(s=>s.includes(t))?8:0)+(body.includes(t)?1:0),0);if(score)found.push({path:f.path,score});}return found.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,limit);}
export async function context(graph,query,{limit=5,maxTokens=4000}={}){
 let used=0;const selected=[];
 const baseline=graph.files.reduce((sum,f)=>sum+Math.ceil(f.bytes/4),0);
 const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean);
 for(const f of await searchFiles(graph,query,{limit:graph.files.length})){
  if(selected.length>=limit||used>=maxTokens)break;
  const lines=(await readContextFile(graph,f.path)).split(/\r?\n/);
  const hits=[];for(let i=0;i<lines.length;i++)if(terms.some(t=>lines[i].toLowerCase().includes(t)))hits.push(i);
  if(!hits.length)hits.push(0);
  const windows=[];
  for(const i of hits.slice(0,12)){
   const a=Math.max(0,i-2),b=Math.min(lines.length,i+3);
   if(windows.length&&a<=windows[windows.length-1][1])windows[windows.length-1][1]=Math.max(b,windows[windows.length-1][1]);
   else windows.push([a,b]);
  }
  const snippets=[];
  for(const [a,b] of windows){
   let content=lines.slice(a,b).map((line,j)=>(a+j+1)+': '+line).join('\n');
   const available=maxTokens-used;
   if(available<=0)break;
   if(estimateTokens(content)>available)content=content.slice(0,available*4);
   if(!content)continue;
   const cost=estimateTokens(content);
   snippets.push({startLine:a+1,endLine:b,content,estimatedTokens:cost});
   used+=cost;
  }
  if(snippets.length)selected.push({path:f.path,snippets,content:snippets.map(s=>s.content).join('\n'),estimatedTokens:snippets.reduce((n,s)=>n+s.estimatedTokens,0)});
 }
 return {query,selected,estimatedContextTokens:used,estimatedBaselineTokens:baseline,estimatedTokensSaved:Math.max(0,baseline-used),estimatedSavingsPercent:baseline?Math.round(100*(baseline-used)/baseline):0,method:'characters/4 estimate; full repository theoretical baseline, not actual LLM savings'};
}
export async function save(graph,root=graph.root){const dir=path.join(root,'.repo-graph');await mkdir(dir,{recursive:true});const target=path.join(dir,'graph.json');await writeFile(target,JSON.stringify(graph,null,2));return target;}
export async function load(root){const g=JSON.parse(await readFile(path.join(path.resolve(root),'.repo-graph','graph.json'),'utf8'));if(g.schemaVersion!==4)throw Error('Re-index required');return g;}
export async function semanticSearch(graph,query,{embed,limit=5}={}){if(typeof embed!=='function')throw Error('Provide embed(text)');const q=await embed(query),norm=v=>Math.sqrt(v.reduce((n,x)=>n+x*x,0)),qn=norm(q),rows=[];for(const f of graph.files){const v=await embed(await readContextFile(graph,f.path));if(v.length!==q.length)throw Error('Embedding dimension mismatch');const vn=norm(v);rows.push({path:f.path,score:qn&&vn?v.reduce((n,x,i)=>n+x*q[i],0)/(qn*vn):0});}return rows.sort((a,b)=>b.score-a.score).slice(0,limit);}
export async function routeTask(input,{decide,models={},agents={},fallback='default'}={}){if(typeof decide!=='function')throw Error('Provide decide(input)');const decision=await decide(input),kind=decision?.kind==='agent'?'agent':'model',name=decision?.name||fallback,registry=kind==='agent'?agents:models;if(!Object.hasOwn(registry,name))throw Error('Unregistered '+kind+': '+name);return {kind,name,decision,execute:(...args)=>registry[name](input,...args)};}
);if(regex.test(rel))matched=!negate;}return matched;}
function resolve(spec,rel,known){if(!spec.startsWith('.'))return 'module:'+spec;const base=norm(path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec)));return 'file:'+([base,base+'.js',base+'.ts',base+'.tsx',base+'.jsx',base+'/index.js',base+'/index.ts'].find(p=>known.has(p))||'__missing__')==='file:__missing__'?'module:'+spec:'file:'+([base,base+'.js',base+'.ts',base+'.tsx',base+'.jsx',base+'/index.js',base+'/index.ts'].find(p=>known.has(p)));}
export async function scan(root,{maxBytes=256000,previous=null,parser='regex'}={}){
 if(!['regex','typescript'].includes(parser))throw Error('Unknown parser');
 root=path.resolve(root);const ps=await patterns(root),files=[],nodes=[],edges=[],contents=new Map(),prior=new Map((previous?.files||[]).map(f=>[f.path,f]));let reusedFiles=0;
 async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){if(ent.isSymbolicLink()||skip.has(ent.name)||ent.name.startsWith('.venv'))continue;const full=path.join(dir,ent.name),rel=norm(path.relative(root,full));if(ignored(rel,ps)||sensitive.test(rel))continue;if(ent.isDirectory()){await walk(full);continue;}if(!ent.isFile()||!ext.has(path.extname(ent.name)))continue;let content;try{content=await readFile(full,'utf8');}catch{continue;}const bytes=Buffer.byteLength(content);if(bytes>maxBytes||content.includes('\0')||secretPattern.test(content))continue;const hash=createHash('sha256').update(content).digest('hex');if(prior.get(rel)?.hash===hash)reusedFiles++;files.push({path:rel,hash,bytes});contents.set(rel,content);}}
 await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));const known=new Set(files.map(f=>f.path));
 for(const f of files){const content=contents.get(f.path),id='file:'+f.path;nodes.push({id,type:'file',name:f.path,hash:f.hash});let symbols=[],imports=[];const old=prior.get(f.path);
 if(old?.hash===f.hash&&previous?.parser===parser&&Array.isArray(old.symbols)&&Array.isArray(old.imports)){symbols=old.symbols;imports=old.imports;}
 else if(parser==='typescript'&&/\.[cm]?[jt]sx?$/.test(f.path)){const ast=await extractTypeScript(content,f.path);symbols=ast.symbols;imports=ast.imports;}
 else{symbols=[...content.matchAll(/\b(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|def)\s+([A-Za-z_$][\w$]*)/g)].map(m=>({name:m[1]}));imports=[...content.matchAll(/(?:import\s+(?:[^'"]+?\s+from\s+)?|require\s*\(|from\s+)['"]([^'"]+)['"]/g)].map(m=>m[1]);}
 f.symbols=symbols;f.imports=imports;
 for(const s of symbols){const sid='symbol:'+f.path+':'+s.name;nodes.push({id:sid,type:'symbol',name:s.name,file:f.path,...(s.line?{line:s.line}:{})});edges.push({from:id,to:sid,type:'contains'});}
 for(const spec of imports)edges.push({from:id,to:resolve(spec,f.path,known),type:'imports'});
 }
 for(const e of edges.filter(e=>e.to.startsWith('module:')))if(!nodes.some(n=>n.id===e.to))nodes.push({id:e.to,type:'module',name:e.to.slice(7)});
 return {schemaVersion:4,root,generatedAt:new Date().toISOString(),nodes,edges,files,reusedFiles,parser};
}
export async function readContextFile(graph,rel){const root=path.resolve(graph.root),file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!graph.files.some(f=>f.path===rel))throw Error('Unsafe or unindexed file');const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe file type');const actual=await realpath(file),realRoot=await realpath(root);if(!actual.startsWith(realRoot+path.sep))throw Error('File escaped repository');const content=await readFile(actual,'utf8');if(secretPattern.test(content))throw Error('Potential secret detected');return content;}
export async function searchFiles(graph,query,{limit=10}={}){const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];const found=[];for(const f of graph.files){const body=(await readContextFile(graph,f.path)).toLowerCase(),name=f.path.toLowerCase(),symbols=(f.symbols||[]).map(s=>s.name.toLowerCase()),score=terms.reduce((n,t)=>n+(name.includes(t)?5:0)+(symbols.some(s=>s.includes(t))?8:0)+(body.includes(t)?1:0),0);if(score)found.push({path:f.path,score});}return found.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,limit);}
export async function context(graph,query,{limit=5,maxTokens=4000}={}){let used=0,baseline=0;const selected=[];for(const f of graph.files)baseline+=estimateTokens(await readContextFile(graph,f.path));for(const f of await searchFiles(graph,query,{limit:graph.files.length})){if(selected.length>=limit)break;const content=await readContextFile(graph,f.path),cost=estimateTokens(content);if(used+cost>maxTokens)continue;selected.push({path:f.path,content,estimatedTokens:cost});used+=cost;}return {query,selected,estimatedContextTokens:used,estimatedBaselineTokens:baseline,estimatedTokensSaved:Math.max(0,baseline-used),estimatedSavingsPercent:baseline?Math.round(100*(baseline-used)/baseline):0,method:'characters/4 heuristic'};}
export async function save(graph,root=graph.root){const dir=path.join(root,'.repo-graph');await mkdir(dir,{recursive:true});const target=path.join(dir,'graph.json');await writeFile(target,JSON.stringify(graph,null,2));return target;}
export async function load(root){const g=JSON.parse(await readFile(path.join(path.resolve(root),'.repo-graph','graph.json'),'utf8'));if(g.schemaVersion!==4)throw Error('Re-index required');return g;}
export async function semanticSearch(graph,query,{embed,limit=5}={}){if(typeof embed!=='function')throw Error('Provide embed(text)');const q=await embed(query),norm=v=>Math.sqrt(v.reduce((n,x)=>n+x*x,0)),qn=norm(q),rows=[];for(const f of graph.files){const v=await embed(await readContextFile(graph,f.path));if(v.length!==q.length)throw Error('Embedding dimension mismatch');const vn=norm(v);rows.push({path:f.path,score:qn&&vn?v.reduce((n,x,i)=>n+x*q[i],0)/(qn*vn):0});}return rows.sort((a,b)=>b.score-a.score).slice(0,limit);}
export async function routeTask(input,{decide,models={},agents={},fallback='default'}={}){if(typeof decide!=='function')throw Error('Provide decide(input)');const decision=await decide(input),kind=decision?.kind==='agent'?'agent':'model',name=decision?.name||fallback,registry=kind==='agent'?agents:models;if(!Object.hasOwn(registry,name))throw Error('Unregistered '+kind+': '+name);return {kind,name,decision,execute:(...args)=>registry[name](input,...args)};}
