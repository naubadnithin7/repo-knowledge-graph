import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {scan,search,context,save,load,estimateTokens} from '../src/index.js';
test('indexes symbols and imports, searches, persists and estimates',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'repo-graph-'));
 try{
  await mkdir(path.join(root,'src'));
  await writeFile(path.join(root,'src','alpha.js'),"export function hello() { return 'world'; }\n");
  await writeFile(path.join(root,'src','beta.js'),"import { hello } from './alpha.js';\n");
  const g=await scan(root);
  assert.equal(g.files.length,2);
  assert.ok(g.nodes.some(n=>n.name==='hello'));
  assert.ok(g.edges.some(e=>e.type==='imports'));
  assert.equal(search(g,'hello')[0].path,'src/alpha.js');
  assert.equal(context(g,'hello',{limit:1}).selected.length,1);
  await save(g);assert.equal((await load(root)).files.length,2);
  assert.equal(estimateTokens('abcd'),1);
 }finally{await rm(root,{recursive:true,force:true});}
});
