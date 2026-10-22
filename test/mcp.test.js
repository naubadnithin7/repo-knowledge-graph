import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {scan,save} from '../src/index.js';
import {callTool,startMcp} from '../src/mcp.js';
import {PassThrough} from 'node:stream';
test('MCP tools discover graph, retrieve context and refresh',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'repo-mcp-'));
 try{
  await writeFile(path.join(root,'auth.js'),'export function authenticate(){return true;}');
  await save(await scan(root));
  const stats=await callTool(root,'repo_stats');assert.match(stats.content[0].text,/"files":1/);
  const results=await callTool(root,'repo_search',{query:'authenticate'});assert.match(results.content[0].text,/auth.js/);
  const ctx=await callTool(root,'repo_context',{query:'authenticate',maxTokens:1000});assert.match(ctx.content[0].text,/authenticate/);
  await assert.rejects(()=>callTool(root,'repo_context',{query:'',maxTokens:1000}),/query required/);
  await assert.rejects(()=>callTool(root,'repo_context',{query:'auth',maxTokens:999999}),/Invalid integer/);
  const refreshed=await callTool(root,'repo_refresh');assert.match(refreshed.content[0].text,/"files":1/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('stdio MCP initialize and tool listing',async()=>{
 const input=new PassThrough(),output=new PassThrough();let received='';output.on('data',d=>received+=d.toString());
 const server=startMcp(process.cwd(),{input,output});
 input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05'}})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
 await new Promise(resolve=>setTimeout(resolve,30));server.close();
 const lines=received.trim().split('\n').map(JSON.parse);assert.equal(lines.length,2);
 assert.equal(lines[0].result.serverInfo.name,'repo-knowledge-graph');
 assert.equal(lines[1].result.tools.length,4);
});
