import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const cli=fileURLToPath(new URL('../bin/repo-graph.js',import.meta.url));
test('CLI index, search, context and savings end to end',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'rkg-cli-'));
 const run=(...args)=>{const result=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
 try{
  await writeFile(path.join(root,'auth.js'),'export function authenticate() { return true; }\n');
  await writeFile(path.join(root,'billing.js'),'export function invoice() { return 42; }\n');
  const indexed=run('index');assert.equal(indexed.files,2);
  assert.equal(run('stats').files,2);
  assert.equal(run('search','authenticate')[0].path,'auth.js');
  assert.equal(run('context','authenticate').selected[0].path,'auth.js');
  assert.ok(run('savings','authenticate').estimatedSavingsPercent>0);
  const second=run('index');assert.equal(second.reusedFiles??second.unchangedFiles,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
