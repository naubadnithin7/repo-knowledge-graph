import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startHttpMcp} from '../src/http.js';
test('HTTP MCP stateless initialize, list and call tools',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'repo-http-'));
 await writeFile(path.join(root,'auth.js'),'export function authenticate(){return true;}');
 const server=await startHttpMcp(root,{port:0,token:'test-secret'});
 const url='http://127.0.0.1:'+server.address().port+'/mcp';
 const post=(body,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer test-secret',...headers},body:JSON.stringify(body)});
 try{
  const unauthorized=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);
  const init=await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}});assert.equal(init.status,200);assert.equal((await init.json()).result.serverInfo.version,'0.7.0');
  const list=await post({jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal((await list.json()).result.tools.length,4);
  const stats=await post({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'repo_stats',arguments:{}}});assert.match(JSON.stringify(await stats.json()),/files/);
  const notification=await post({jsonrpc:'2.0',method:'notifications/initialized'});assert.equal(notification.status,202);
  const denied=await post({jsonrpc:'2.0',id:4,method:'ping'},{Origin:'https://evil.example'});assert.equal(denied.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
