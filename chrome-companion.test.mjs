import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createService} from './server.mjs';
import {createCompanion,leaseView,isSource,isYouTube} from './chrome-companion/session.mjs';
import {platforms,allowedPlatform} from './chrome-companion/platforms.mjs';
import vm from 'node:vm';
const sender=(id,url)=>({id:'test-extension',frameId:0,tab:{id},url});
const source=sender(1,'http://localhost:8787/'),youtube=sender(2,'https://www.youtube.com/');
test('elapsed testing clock continues across renewals and page reloads; normal mode counts down',()=>{
  const context=vm.createContext({});vm.runInContext(readFileSync(new URL('./chrome-companion/timer.js',import.meta.url),'utf8'),context);
  let now=0;const clock=new context.DailyScrollClock(()=>now);
  clock.accept({testingMode:true,elapsed:62000});now=3000;assert.equal(clock.text(),'01:05 elapsed');
  clock.accept({testingMode:true,elapsed:65000});now=7000;assert.equal(clock.text(),'01:09 elapsed');
  clock.accept({testingMode:true,elapsed:68000});assert.equal(clock.text(),'01:09 elapsed','slightly delayed server samples must not move the clock backwards');
  const reloaded=new context.DailyScrollClock(()=>now);reloaded.accept({testingMode:true,elapsed:69000});assert.equal(reloaded.text(),'01:09 elapsed');
  clock.accept({testingMode:false,remaining:3600000});now+=4000;assert.equal(clock.text(),'59:56');
});
function browser(budget){
  const data={},calls=[];const tabs=new Map([[1,{id:1,url:source.url}]]);
  const chrome={runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p},
    storage:{session:{get:async()=>structuredClone(data),set:async value=>Object.assign(data,structuredClone(value)),remove:async key=>{delete data[key];}}},
    windows:{create:async options=>{calls.push(['create',options]);const tab={id:2,url:options.url};tabs.set(2,tab);return {id:10,tabs:[tab]};},update:async()=>{},remove:async()=>{}},
    tabs:{get:async id=>{if(!tabs.has(id))throw Error('Tab closed');return tabs.get(id);},update:async(id,change)=>{calls.push(['update',id,change]);Object.assign(tabs.get(id),change);return tabs.get(id);},sendMessage:async(id,message)=>{calls.push(['message',id,message]);if(message.type==='daily-budget')return budget(message.route,message.platform);return {ok:true};}}};
  return {chrome,calls,data,tabs};
}
test('opens actual YouTube with sound enabled; one managed window; no cookie permission',async()=>{
  const f=browser(async()=>({ok:true,me:{open:true,remaining:3600000,now:1000,allowedUntil:16000}}));
  const c=createCompanion({chrome:f.chrome,clock:()=>1000});await c.handle({type:'daily-open'},source);
  const updates=f.calls.filter(x=>x[0]==='update');assert.deepEqual(updates.slice(0,2),[['update',2,{muted:false}],['update',2,{url:'https://www.youtube.com/'}]]);
  assert.equal(f.calls.find(x=>x[0]==='create')[1].url,'about:blank');
  await c.handle({type:'daily-open'},source);assert.equal(f.calls.filter(x=>x[0]==='create').length,1);
  const manifest=JSON.parse(readFileSync(new URL('./chrome-companion/manifest.json',import.meta.url)));assert.deepEqual(manifest.permissions,['storage','alarms']);
  assert.equal(manifest.host_permissions.some(url=>url.includes('accounts.google')),false);
});
test('all six official destinations get a sound-enabled window, valid heartbeat and matching budget platform',async()=>{
  const manifest=JSON.parse(readFileSync(new URL('./chrome-companion/manifest.json',import.meta.url)));
  for(const [platform,config] of Object.entries(platforms)){
    let now=1000;
    const routes=[];const f=browser(async(route,chosen)=>{routes.push([route,chosen]);return {ok:true,me:{open:true,remaining:3600000,now,allowedUntil:now+15000}};});
    const c=createCompanion({chrome:f.chrome,clock:()=>now});await c.handle({type:'daily-open',platform},source);
    assert.equal(f.tabs.get(2).url,config.url);assert.equal(f.tabs.get(2).muted,false);
    for(const origin of config.origins){assert.ok(manifest.content_scripts[1].matches.includes(origin+'/*'));assert.ok(allowedPlatform(platform,origin+'/'));}
    now+=4000;await c.handle({type:'daily-ready'},sender(2,config.url));
    assert.deepEqual(routes,[['start',platform],['pulse',platform]]);
    await c.handle({type:'daily-stop'},sender(2,config.url));assert.equal(await c.read(),undefined);assert.deepEqual(routes.at(-1),['stop',platform]);
    assert.equal(allowedPlatform(platform,config.url.replace('https://','https://evil.example/')),false);
    assert.equal(allowedPlatform(platform,'https://password@'+new URL(config.url).host),false);
  }
});
test('switching platforms stops the previous window before starting the next budget lease',async()=>{
  const f=browser(async()=>({ok:true,me:{open:true,remaining:3600000,now:1,allowedUntil:15001}}));
  const c=createCompanion({chrome:f.chrome,clock:()=>1});
  await c.handle({type:'daily-open',platform:'YouTube'},source);
  await c.handle({type:'daily-open',platform:'Instagram'},source);
  assert.deepEqual(f.calls.filter(x=>x[0]==='message'&&x[2].type==='daily-budget').map(x=>[x[2].route,x[2].platform]),[['start','YouTube'],['stop','YouTube'],['start','Instagram']]);
  assert.equal((await c.read()).platform,'Instagram');
  await assert.rejects(c.handle({type:'daily-open',platform:'constructor'},source));
});
test('official login redirects keep the same allowance without content access to login pages',async()=>{
  let now=1000;const f=browser(async()=>({ok:true,me:{open:true,remaining:3600000,now,allowedUntil:now+15000}}));
  const c=createCompanion({chrome:f.chrome,clock:()=>now});await c.handle({type:'daily-open',platform:'YouTube'},source);
  f.tabs.get(2).url='https://accounts.google.com/';
  now+=4000;await c.heartbeat();assert.ok((await c.read()).lease.deadline>now);
  await assert.rejects(c.handle({type:'daily-ready'},sender(2,'https://accounts.google.com/')));
  f.tabs.get(2).url='https://evil.example/';await assert.rejects(c.heartbeat());assert.equal(await c.read(),undefined);
});
test('rejects foreign pages, frames, arbitrary operations and unmanaged YouTube tabs',async()=>{
  const f=browser(()=>{throw Error('must not reach budget');}),c=createCompanion({chrome:f.chrome});
  for(const bad of [sender(1,'https://evil.example/'),sender(1,'http://localhost:8787.evil.example/'),{...source,frameId:1},{...source,id:'other'}])await assert.rejects(c.handle({type:'daily-open'},bad));
  await assert.rejects(c.handle({type:'daily-pulse'},youtube));assert.equal(f.calls.length,0);
  assert.equal(isSource('http://localhost:8787@evil.example'),false);assert.equal(isYouTube('https://www.youtube.com.evil.example'),false);
  assert.throws(()=>leaseView({open:true,remaining:1,now:10,allowedUntil:9}));
});
test('worker restart retains window; expiry blocks rather than renewing a stale allowance',async()=>{
  let now=1000;
  const f=browser(async()=>({ok:true,me:{open:true,remaining:3600000,now,allowedUntil:now+15000}}));
  await createCompanion({chrome:f.chrome,clock:()=>now}).handle({type:'daily-open'},source);
  const resumed=createCompanion({chrome:f.chrome,clock:()=>now});now+=4000;
  assert.ok((await resumed.handle({type:'daily-ready'},youtube)).deadline>now);
  now+=16000;await assert.rejects(resumed.handle({type:'daily-pulse'},youtube),/expired/);
  assert.equal(await resumed.read(),undefined);assert.match(f.tabs.get(2).url,/closed.html/);
  assert.equal(f.calls.filter(x=>x[0]==='message'&&x[2].route==='stop').length,1);
});
test('closing source stops managed browsing; another source cannot stop it',async()=>{
  const f=browser(async()=>({ok:true,me:{open:true,remaining:3600000,now:1,allowedUntil:15001}}));
  const c=createCompanion({chrome:f.chrome,clock:()=>1});await c.handle({type:'daily-open'},source);
  await assert.rejects(c.handle({type:'daily-close'},sender(8,source.url)));
  await c.removed(1);assert.equal(await c.read(),undefined);assert.match(f.tabs.get(2).url,/closed.html/);
});
test('all six companion platforms share the real server allowance and stop at the hour boundary',async()=>{
  let now=Date.parse('2026-10-21T00:00:00Z');
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-chrome-'));
  const server=createService({directory,clock:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;let cookie;
  async function call(route,body){const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie||'',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {response,me:await response.json()};}
  try{
    const guest=await call('guest',{zone:'America/New_York'});cookie=guest.response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const f=browser(async(route,platform)=>{const {response,me}=await call(route,{platform});return response.ok?{ok:true,me}:{ok:false,error:me.error};});
    const c=createCompanion({chrome:f.chrome,clock:()=>now});let used=0;
    for(const [platform,config] of Object.entries(platforms)){
      await c.handle({type:'daily-open',platform},source);now+=1000;
      await c.handle({type:'daily-pulse'},sender(2,config.url));now+=1000;
      await c.handle({type:'daily-close'},source);used+=2000;
      assert.equal((await call('me')).me.used,used,'switching '+platform+' must not reset the allowance');
    }
    now=Date.parse('2026-10-21T00:59:50Z');await c.handle({type:'daily-open'},source);
    now+=4000;await c.handle({type:'daily-pulse'},youtube);assert.equal((await call('me')).me.used,used+4000);
    now+=7000;await assert.rejects(c.handle({type:'daily-pulse'},youtube));
    assert.equal(await c.read(),undefined);assert.equal((await call('me')).me.open,false);assert.match(f.tabs.get(2).url,/closed.html/);
    const script=await fetch(base+'/chrome-companion.zip');assert.equal(script.status,200);assert.equal(script.headers.get('content-type'),'application/zip');
  }finally{await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
});
