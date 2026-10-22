import {stdin,stdout,stderr} from 'node:process';
import {scan,save,load,searchFiles,context} from './index.js';

const definitions=[
 {name:'repo_search',description:'Find relevant repository files',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:30}},required:['query']}},
 {name:'repo_context',description:'Retrieve focused repository context within a token budget',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:20},maxTokens:{type:'integer',minimum:1,maximum:16000}},required:['query']}},
 {name:'repo_stats',description:'Show indexed repository graph statistics',inputSchema:{type:'object',properties:{}}},
 {name:'repo_refresh',description:'Refresh the repository knowledge graph',inputSchema:{type:'object',properties:{}}}
];
const result=(value)=>({content:[{type:'text',text:JSON.stringify(value)}]});
export async function callTool(root,name,args={}){
 if(name==='repo_refresh'){let previous;try{previous=await load(root);}catch{}const g=await scan(root,{previous});await save(g);return result({files:g.files.length,nodes:g.nodes.length,edges:g.edges.length,reusedFiles:g.reusedFiles});}
 const g=await load(root);
 if(name==='repo_stats')return result({files:g.files.length,nodes:g.nodes.length,edges:g.edges.length});
 if(name==='repo_search')return result(await searchFiles(g,requireQuery(args),{limit:integer(args.limit,10,30)}));
 if(name==='repo_context')return result(await context(g,requireQuery(args),{limit:integer(args.limit,5,20),maxTokens:integer(args.maxTokens,4000,16000)}));
 throw Error('Unknown tool: '+name);
}
function integer(value,fallback,max){if(value===undefined)return fallback;if(!Number.isInteger(value)||value<1||value>max)throw Error('Invalid integer argument');return value;}
function requireQuery(args){if(typeof args.query!=='string'||!args.query.trim()||args.query.length>1000)throw Error('Nonempty query required (max 1000 characters)');return args.query;}
export function startMcp(root=process.cwd(),{input=stdin,output=stdout}={}){
 let buffer='',queue=Promise.resolve();
 const send=msg=>output.write(JSON.stringify(msg)+'\n');
 const handle=async msg=>{
  if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return;
  if(msg.id===undefined)return;
  try{
   let value;
   if(msg.method==='initialize')value={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'repo-knowledge-graph',version:'0.6.0'}};
   else if(msg.method==='ping')value={};
   else if(msg.method==='tools/list')value={tools:definitions};
   else if(msg.method==='tools/call')value=await callTool(root,msg.params?.name,msg.params?.arguments??{});
   else {send({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Method not found'}});return;}
   send({jsonrpc:'2.0',id:msg.id,result:value});
  }catch(e){send({jsonrpc:'2.0',id:msg.id,error:{code:-32603,message:e.message}});}
 };
 input.setEncoding('utf8');
 input.on('data',chunk=>{buffer+=chunk;if(buffer.length>1048576){buffer='';stderr.write('MCP message too large\n');return;}let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos).trim();buffer=buffer.slice(pos+1);if(!line)continue;queue=queue.then(()=>handle(JSON.parse(line))).catch(e=>stderr.write('MCP invalid message: '+e.message+'\n'));}});
 return {close:()=>input.removeAllListeners('data')};
}
