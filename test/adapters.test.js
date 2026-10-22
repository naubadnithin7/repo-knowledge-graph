import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDecisionAdapter,transformGraph} from '../src/adapters.js';
import {benchmark} from '../src/benchmark.js';
test('decision endpoint validates host and output',async()=>{
 assert.throws(()=>createDecisionAdapter({endpoint:'https://example.com/v1/chat/completions'}),/allowlisted/);
 const decide=createDecisionAdapter({endpoint:'http://localhost:9000/v1/chat/completions',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"kind":"model","name":"small"}'}}]})})});
 assert.deepEqual(await decide('hello'),{kind:'model',name:'small'});
});
test('graph transform and retrieval benchmark',async()=>{
 assert.deepEqual(await transformGraph({nodes:[]},{transform:async g=>g}),{nodes:[]});
 const result=await benchmark({},[{query:'payment',relevantPaths:['a.js']}],{retrieve:async()=>[{path:'a.js',content:'abcd'}]});
 assert.equal(result.meanRecallAtK,1);assert.equal(result.meanPrecisionAtK,1);assert.equal(result.meanSelectedTokens,1);
});
