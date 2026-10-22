import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {callTool} from './mcp.js';

const tools=[
 {name:'repo_search',description:'Find relevant repository files',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:30}},required:['query']}},
 {name:'repo_context',description:'Retrieve focused repository context within a token budget',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:20},maxTokens:{type:'integer',minimum:1,maximum:16000}},required:['query']}},
 {name:'repo_stats',description:'Show indexed repository graph statistics',inputSchema:{type:'object',properties:{}}},
 {name:'repo_refresh',description:'Refresh the repository knowledge graph',inputSchema:{type:'object',properties:{}}}
];
function safeEqual(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function json(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));}
function error(id,code,message){return {jsonrpc:'2.0',id,error:{code,message}};}
export async function startHttpMcp(root=process.cwd(),{host='127.0.0.1',port=3333,token=process.env.REPO_GRAPH_MCP_TOKEN,allowedOrigins=[]}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
 if(!['127.0.0.1','::1','localhost'].includes(host)&&!token)throw Error('REPO_GRAPH_MCP_TOKEN is required for non-loopback binding');
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&(!allowedOrigins.includes(origin))){json(res,403,{error:'Origin not allowed'});return;}
  if(token&&(!req.headers.authorization?.startsWith('Bearer ')||!safeEqual(req.headers.authorization.slice(7),token))){json(res,401,{error:'Unauthorized'},{'WWW-Authenticate':'Bearer'});return;}
  if(req.url!=='/mcp'){json(res,404,{error:'Not found'});return;}
  if(req.method==='GET'){res.writeHead(405,{'Allow':'POST','Cache-Control':'no-store'});res.end();return;}
  if(req.method!=='POST'){json(res,405,{error:'Method not allowed'},{Allow:'POST'});return;}
  if(!req.headers['content-type']?.toLowerCase().startsWith('application/json')){json(res,415,{error:'Expected application/json'});return;}
  let raw='';try{
   for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1048576){json(res,413,{error:'Payload too large'});return;}}
   let msg;try{msg=JSON.parse(raw);}catch{json(res,400,error(null,-32700,'Parse error'));return;}
   if(!msg||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'){json(res,400,error(msg?.id??null,-32600,'Invalid Request'));return;}
   if(msg.id===undefined){res.writeHead(202,{'Cache-Control':'no-store'});res.end();return;}
   let value;
   if(msg.method==='initialize')value={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'repo-knowledge-graph',version:'0.7.0'}};
   else if(msg.method==='ping')value={};
   else if(msg.method==='tools/list')value={tools};
   else if(msg.method==='tools/call')value=await callTool(root,msg.params?.name,msg.params?.arguments??{});
   else {json(res,200,error(msg.id,-32601,'Method not found'));return;}
   json(res,200,{jsonrpc:'2.0',id:msg.id,result:value},{'Mcp-Session-Id':'', 'Vary':'Origin'});
  }catch(e){if(!res.headersSent)json(res,200,error(null,-32603,e.message));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
 return server;
}
