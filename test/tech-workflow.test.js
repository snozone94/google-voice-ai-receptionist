import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowClient, workflowBase, mountTechWorkflow } from '../src/tech-workflow.js';
const authUrl='https://example.test/sub/wp-json/ddd/v1/tech-auth-test';
const ok=data=>({ok:true,status:200,json:async()=>data});
test('shared workflow derives from the existing configured WordPress auth origin',()=>assert.equal(workflowBase(authUrl+'?secret=discard#discard'),'https://example.test/sub/wp-json/ddd/v1/tech-workflow'));
test('invalid or non-HTTPS config and embedded credentials fail closed',()=>{for(const url of ['','http://example.test/tech-auth-test','https://user:password@example.test/tech-auth-test','https://example.test/unrelated'])assert.equal(workflowBase(url),'');});
test('only the signed-in person credential is sent in headers, with no service-token fallback',async()=>{
 let request;const client=createWorkflowClient({authUrl,fetchImpl:async(url,options)=>{request={url,options};return ok({notes:[]});}});
 await client('person-code','/inbox');assert.equal(request.url,'https://example.test/sub/wp-json/ddd/v1/tech-workflow/inbox');assert.equal(request.options.headers['X-DDD-Tech-Token'],'person-code');assert.equal(request.options.redirect,'error');assert.ok(!request.url.includes('person-code'));assert.equal(request.options.method,'GET');
});
test('missing credentials never fall back to a privileged team token',async()=>{const client=createWorkflowClient({authUrl});await assert.rejects(()=>client('','/team'),e=>e.status===401);});
test('unknown workflow paths cannot proxy owner settings or arbitrary routes',async()=>{const client=createWorkflowClient({authUrl});for(const path of ['/settings','/business','/../jobs','/inbox/a%2Fb/response'])await assert.rejects(()=>client('person-code',path),e=>e.status===400);});
test('team reads cannot be used to change availability or job state',async()=>{const client=createWorkflowClient({authUrl});await assert.rejects(()=>client('person-code','/team',{availability:'available'}),e=>e.status===405);});
test('responses and internal notes write to the same WordPress records',async()=>{let request;const client=createWorkflowClient({authUrl,fetchImpl:async(url,options)=>{request={url,options};return ok({ok:true});}});await client('person-code','/inbox/note_123/response',{action:'accept'});assert.equal(request.options.method,'POST');assert.deepEqual(JSON.parse(request.options.body),{action:'accept'});});
test('WordPress denial is not converted into empty or fabricated success',async()=>{const client=createWorkflowClient({authUrl,fetchImpl:async()=>({ok:false,status:403,json:async()=>({message:'private server detail'})})});await assert.rejects(()=>client('person-code','/team'),e=>e.status===403&&!e.message.includes('private server detail'));});
test('upstream missing plugin, malformed data and network failures are explicit',async()=>{
 for(const [fetchImpl,status] of [[async()=>({ok:false,status:404,json:async()=>({})}),404],[async()=>ok(null),502],[async()=>{throw Error('network');},502]]){const client=createWorkflowClient({authUrl,fetchImpl});await assert.rejects(()=>client('person-code','/team'),e=>e.status===status);}
});
const setup=()=>{const routes=[];const app={get:(path,...handlers)=>routes.push({method:'GET',path,handlers}),post:(path,...handlers)=>routes.push({method:'POST',path,handlers})};const staffOnly=()=>{};const calls=[];mountTechWorkflow(app,{staffOnly,authUrl,fetchImpl:async(url,options)=>{calls.push({url,options});return ok({ok:true});}});return{routes,staffOnly,calls};};
const res=role=>({locals:{staff:{role}},headers:{},statusCode:200,set(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(value){this.value=value;return this;}});
test('every coordination endpoint retains staff authentication',()=>{const{routes,staffOnly}=setup();assert.equal(routes.length,4);for(const r of routes)assert.ok(r.handlers.includes(staffOnly));});
test('review accounts cannot send notes or read live technician data',async()=>{const{routes,calls}=setup();for(const route of routes){const response=res('reviewer');await route.handlers.at(-1)({},response);assert.equal(response.statusCode,403);}assert.equal(calls.length,0);});
test('client cannot impersonate sender, expand visibility or forward an owner role',async()=>{
 const{routes,calls}=setup();const response=res('tech');await routes.find(r=>r.path==='/api/tech-workflow/inbox'&&r.method==='POST').handlers.at(-1)({get:()=> 'person-code',body:{message:'Need help',type:'admin_note',sender_tech_id:'owner',owner:true,customer_visible:true}},response);
 const body=JSON.parse(calls[0].options.body);assert.equal(body.type,'dispatch_note');assert.ok(!('sender_tech_id'in body));assert.ok(!('owner'in body));assert.ok(!('customer_visible'in body));assert.equal(response.headers['Cache-Control'],'no-store, private');
});
