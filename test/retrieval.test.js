import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {scan,save,load,context} from '../src/index.js';
import {callTool} from '../src/mcp.js';

test('gitignore patterns, negation, and virtualenv exclusions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'repo-ignore-'));
 try{
  await mkdir(path.join(root,'generated'));await mkdir(path.join(root,'.venv310'));
  await writeFile(path.join(root,'.gitignore'),'*.log\ngenerated/\n!generated/keep.js\n');
  await writeFile(path.join(root,'main.js'),'export function authenticate(){ return true; }');
  await writeFile(path.join(root,'debug.log'),'secret');
  await writeFile(path.join(root,'generated','skip.js'),'skip');
  await writeFile(path.join(root,'.venv310','deps.py'),'skip');
  const g=await scan(root);
  assert(g.files.some(f=>f.path==='main.js'));
  assert(!g.files.some(f=>f.path==='debug.log'||f.path.startsWith('.venv310/')));
  assert(!g.files.some(f=>f.path==='generated/skip.js'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('MCP refreshes changed files automatically',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'repo-fresh-'));
 try{
  await writeFile(path.join(root,'main.js'),'export function original(){ return 1; }');
  await save(await scan(root));
  await writeFile(path.join(root,'main.js'),'export function updated(){ return 2; }');
  const response=await callTool(root,'repo_search',{query:'updated'});
  assert.match(response.content[0].text,/main.js/);
  const persisted=await load(root);
  assert.equal(persisted.files[0].hash,(await scan(root)).files[0].hash);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('context returns line numbered snippets within token budget',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'repo-context-'));
 try{
  await writeFile(path.join(root,'main.js'),'const ignored = 1;\nfunction authenticate(){\n return true;\n}\n');
  const g=await scan(root);
  const result=await context(g,'authenticate',{maxTokens:40});
  assert(result.estimatedContextTokens<=40);
  assert(result.selected.length>0);
  assert(result.selected[0].snippets.length>0);
  assert.match(result.selected[0].snippets[0].content,/2: function authenticate/);
 }finally{await rm(root,{recursive:true,force:true});}
});
