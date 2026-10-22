/** Optional TypeScript compiler AST extractor. Install typescript separately. */
export async function extractTypeScript(source,filename='source.ts'){
 let ts;try{ts=await import('typescript');}catch{throw Error('AST extraction requires: npm install typescript');}
 const kind=/\.[jt]sx$/.test(filename)?ts.ScriptKind.TSX:/\.ts$/.test(filename)?ts.ScriptKind.TS:ts.ScriptKind.JS;
 const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,kind),symbols=[],imports=[];
 function visit(node){
  if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
  if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))imports.push(node.arguments[0].text);
  if((ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isEnumDeclaration(node))&&node.name)symbols.push({name:node.name.text,kind:ts.SyntaxKind[node.kind],line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1});
  ts.forEachChild(node,visit);
 }
 visit(ast);return {symbols,imports:[...new Set(imports)]};
}
/** Local OpenAI-compatible decision endpoint adapter, suitable for a locally served Laya model. */
export function createDecisionAdapter({endpoint,model='laya',apiKey,timeoutMs=10000,fetchImpl=fetch,allowedHosts=['localhost','127.0.0.1','::1']}={}){
 if(!endpoint)throw Error('endpoint required');const url=new URL(endpoint);
 if(!['http:','https:'].includes(url.protocol))throw Error('Only HTTP(S) endpoints allowed');
 if(!allowedHosts.includes(url.hostname))throw Error('Endpoint host not allowlisted');
 return async input=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',...(apiKey?{authorization:'Bearer '+apiKey}:{})},body:JSON.stringify({model,messages:[{role:'system',content:'Choose a registered execution target. Return only JSON: {"kind":"model"|"agent","name":"target"}.'},{role:'user',content:String(input).slice(0,4000)}],temperature:0}),signal:controller.signal});
   if(!response.ok)throw Error('Decision endpoint HTTP '+response.status);
   const data=await response.json(),content=data?.choices?.[0]?.message?.content;
   if(typeof content!=='string'||content.length>2000)throw Error('Invalid decision response');
   const decision=JSON.parse(content);
   if(!['model','agent'].includes(decision.kind)||typeof decision.name!=='string'||!/^[\w.-]{1,80}$/.test(decision.name))throw Error('Invalid routing decision');
   return {kind:decision.kind,name:decision.name};
  }finally{clearTimeout(timer);}
 };
}
/** Graphify or other graph transformation integration boundary; caller supplies adapter. */
export async function transformGraph(graph,{transform}={}){
 if(typeof transform!=='function')throw Error('Supply transform(graph) adapter');
 const result=await transform(graph);if(!result||typeof result!=='object')throw Error('Graph adapter must return an object');return result;
}
