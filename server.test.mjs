import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createService,lanAddress,DESKTOP_RELEASES} from './server.mjs';
import {parsePost} from './content.mjs';

test('the Windows app link sends people to the releases page instead of a file on this computer',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-installer-'));
  const server=createService({directory,testingMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/desktop-installer`,{redirect:'manual'});
    assert.equal(response.status,302);assert.equal(response.headers.get('location'),DESKTOP_RELEASES);
  }finally{await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
});

test('testing mode opens all six outside the daily hour with an exhausted allowance and preserves normal usage',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-testing-'));
  let now=Date.parse('2026-10-20T16:00:00Z'),server,base,cookie='';
  const open=async testingMode=>{server=createService({directory,clock:()=>now,testingMode});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{await new Promise(r=>server.close(r));server=null;};
  async function call(route,body){const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {response,me:await response.json()};}
  try{
    await open(false);const guest=await call('guest',{zone:'America/New_York'});cookie=guest.response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    assert.equal(guest.me.open,false);await close();
    const file=path.join(directory,'store.json'),store=JSON.parse(readFileSync(file,'utf8'));
    for(const user of Object.values(store.users))user.used=3600000;
    for(const device of Object.values(store.devices))device.used=3600000;
    writeFileSync(file,JSON.stringify(store));await open(true);
    let testingElapsed=0;
    for(const platform of ['YouTube','Instagram','TikTok','Facebook','Twitch','Snapchat']){
      const start=await call('start',{platform});assert.equal(start.response.status,200);assert.equal(start.me.open,true);assert.equal(start.me.testingMode,true);assert.equal(start.me.used,3600000);assert.ok(start.me.allowedUntil>now);
      assert.equal(start.me.elapsed,testingElapsed);
      now+=1200000;const pulse=await call('pulse',{platform});assert.equal(pulse.response.status,200);assert.equal(pulse.me.remaining,3600000);assert.equal(pulse.me.used,3600000);
      testingElapsed+=15000;assert.equal(pulse.me.elapsed,testingElapsed);
      await call('stop',{});
    }
    await close();await open(true);assert.equal((await call('me')).me.elapsed,testingElapsed,'testing time must survive restart');
    await close();await open(false);const limited=await call('start',{platform:'YouTube'});assert.equal(limited.response.status,403);assert.equal((await call('me')).me.used,3600000);
  }finally{if(server)await close();rmSync(directory,{recursive:true,force:true});}
});

test('the invite address prefers real Wi-Fi or Ethernet over virtual adapters',()=>{
  const v4=(address,internal=false)=>({address,family:'IPv4',internal});
  const machine={'Ethernet 2':[v4('192.168.56.1')],'Wi-Fi':[{address:'fe80::1',family:'IPv6',internal:false},v4('192.168.1.143')],'vEthernet (WSL)':[v4('172.20.144.1')],'VirtualBox Host-Only Network':[v4('192.168.99.1')],'Tailscale':[v4('100.101.102.103')],'Loopback Pseudo-Interface 1':[v4('127.0.0.1',true)]};
  assert.equal(lanAddress(machine),'192.168.1.143');
  assert.equal(lanAddress({'Ethernet':[v4('10.0.0.5')],'Wi-Fi':[v4('172.16.4.9')]}),'172.16.4.9');
  assert.equal(lanAddress({'Ethernet':[v4('10.0.0.5')],'Docker':[v4('192.168.65.1')]}),'10.0.0.5');
  assert.equal(lanAddress({'Ethernet 2':[v4('192.168.56.1')]}),'192.168.56.1');
  assert.equal(lanAddress({'Ethernet':[v4('203.0.113.4')],'Loopback':[v4('127.0.0.1',true)]}),null);
  assert.equal(lanAddress({}),null);
});
test('all six post types resolve to bounded platform embed URLs',()=>{
  for(const [url,platform]of [
    ['https://youtu.be/M7lc1UVf-VE','YouTube'],
    ['https://www.instagram.com/reel/ABC_123/','Instagram'],
    ['https://www.tiktok.com/@scout2015/video/6718335390845095173','TikTok'],
    ['https://www.facebook.com/example/posts/123456','Facebook'],
    ['https://www.twitch.tv/twitch','Twitch'],
    ['https://www.snapchat.com/spotlight/example-public-post','Snapchat']])assert.equal(parsePost(url)?.platform,platform);
  for(const url of ['javascript:alert(1)','https://youtube.com.evil.com/watch?v=M7lc1UVf-VE','https://evil.com','https://user:pass@instagram.com/p/abc/','https://instagram.com/username','https://vm.tiktok.com/abc/'])assert.equal(parsePost(url),null);
});

test('optional social callback preserves one identity and supports a one-time mobile handoff',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'daily-scroll-oauth-'));
  const env={PUBLIC_ORIGIN:'https://scroll.example',TWITCH_CLIENT_ID:'test-id',TWITCH_CLIENT_SECRET:'test-secret',REQUIRE_SOCIAL_AUTH:'1'};
  const fetcher=async(url)=>url.includes('/token')?Response.json({access_token:'mock-token'}):Response.json({data:[{id:'123456',display_name:'Test Twitch'}]});
  const server=createService({directory,clock:()=>Date.parse('2026-10-20T00:00:00Z'),oauthEnv:env,oauthFetcher:fetcher,requireConnections:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=(route,body,cookie='')=>fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  async function authorize(native,cookie=''){
    const prepared=await(await call('/api/oauth/prepare',{provider:'twitch',native,zone:'America/New_York'},cookie)).json();
    const start=await call(new URL(prepared.url).pathname+new URL(prepared.url).search,undefined,cookie);
    assert.equal(start.status,302);
    const provider=new URL(start.headers.get('location'));
    const binding=start.headers.get('set-cookie').split(';')[0];
    return call(`/api/oauth/twitch/callback?code=mock-code&state=${provider.searchParams.get('state')}`,undefined,binding);
  }
  try{
    const callback=await authorize(false);assert.equal(callback.status,302);
    const session=callback.headers.getSetCookie().find(v=>v.startsWith('scroll_session=')).split(';')[0];
    const me=await(await call('/api/me',undefined,session)).json();assert.ok(me.connections.twitch);assert.equal(me.used,0);
    assert.equal((await call('/api/start',{platform:'TikTok'},session)).status,403);
    assert.equal((await call('/api/start',{platform:'Twitch'},session)).status,200);
    const native=await authorize(true,session);assert.equal(native.status,302);
    const mobile=new URL(native.headers.get('location'));assert.equal(mobile.protocol,'dailyscroll:');
    const redemption='/api/oauth/native?ticket='+mobile.searchParams.get('ticket');
    assert.equal((await call(redemption)).status,302);assert.equal((await call(redemption)).status,400);
    const restored=await(await call('/api/me',undefined,session)).json();assert.equal(restored.name,me.name);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
});

test('accounts, room sync, time-zone schedule, server clock and restart persistence',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'daily-scroll-test-'));
  let now=Date.parse('2026-10-20T00:00:00Z'); // 8 p.m. New York.
  let server=createService({directory,clock:()=>now,requireConnections:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${server.address().port}`;
  let alice='',bob='';
  async function call(route,data,cookie=''){
    const r=await fetch(base+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  try{
    assert.equal((await call('me')).status,401);
    const a=await call('register',{name:'alice',password:'a-real-test-password',zone:'America/New_York'});assert.equal(a.status,200);alice=a.cookie;assert.equal(a.body.open,true);
    const b=await call('register',{name:'bobby',password:'another-test-password',zone:'America/Los_Angeles'});bob=b.cookie;assert.equal(b.body.open,false);
    assert.equal((await call('login',{name:'alice',password:'incorrect-password'})).status,401);
    for(const url of ['https://youtu.be/M7lc1UVf-VE','https://www.instagram.com/p/ABC123/','https://www.tiktok.com/@scout2015/video/6718335390845095173','https://www.facebook.com/example/posts/123'])assert.equal((await call('posts',{url},alice)).status,200);
    assert.equal((await call('posts',{url:'https://evil.com/'},alice)).status,400);
    const room=(await call('rooms/create',{},alice)).body.room;
    assert.equal(room.posts.length,4);
    const joined=await call('rooms/join',{code:room.code},bob);assert.equal(joined.body.room.members.length,2);assert.equal(joined.body.room.host,false);
    const qr=await fetch(base+'/api/room-qr',{headers:{Cookie:bob}});assert.equal(qr.status,200);assert.equal(qr.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await qr.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
    const invite=await call('room-invite',undefined,bob);assert.ok(invite.body.url.endsWith('/?room='+room.code));
    assert.equal((await call('rooms/current',{index:1},bob)).status,403);
    await call('rooms/current',{index:2},alice);assert.equal((await call('me',undefined,bob)).body.room.current,2);
    const adopted=await call('rooms/adopt',{},bob);assert.equal(adopted.body.zone,'America/New_York');assert.equal(adopted.body.open,true);
    await call('start',{},alice);now+=5000;
    const pulse=await call('pulse',{},alice);assert.equal(pulse.body.used,5000);
    assert.equal((await call('schedule',{hour:19,zone:'America/New_York'},alice)).status,409);
    now+=30000;
    const offline=await call('me',undefined,alice);assert.equal(offline.body.used,20000);assert.ok(offline.body.allowedUntil<now);
    await call('rooms/leave',{},alice);const rejoin=await call('rooms/join',{code:room.code},alice);assert.equal(rejoin.body.used,20000);
    assert.equal((await call('rooms/adopt',{},alice)).status,409);
    await call('stop',{},alice);now+=5000;assert.equal((await call('me',undefined,alice)).body.used,20000);
    now=Date.parse('2026-10-20T00:59:58Z');await call('start',{},alice);now+=3000;
    assert.equal((await call('pulse',{},alice)).status,403);
    const closed=await call('me',undefined,alice);assert.equal(closed.body.open,false);assert.equal(closed.body.used,22000);
    await call('stop',{},alice);
    await new Promise(resolve=>server.close(resolve));server=createService({directory,clock:()=>now,requireConnections:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
    const restored=await call('me',undefined,alice);assert.equal(restored.body.posts.length,4);assert.equal(restored.body.used,22000);assert.equal(restored.body.room.current,2);
    now=Date.parse('2026-10-20T04:00:00Z');const nextDay=await call('me',undefined,alice);assert.equal(nextDay.body.used,0);assert.equal(nextDay.body.open,false);
    await call('rooms/leave',{},alice);assert.equal((await call('me',undefined,bob)).body.room.host,true);
    // An entire permitted hour cannot be extended by switching rooms or borrowing
    // the host's account on the same remembered device.
    now=Date.parse('2026-10-21T00:00:00Z');await call('start',{},alice);
    for(let step=1;step<240;step++){now+=15000;assert.equal((await call('pulse',{},alice)).status,200);}
    now+=15000;assert.equal((await call('pulse',{},alice)).status,403);
    const exhausted=await call('me',undefined,alice);assert.equal(exhausted.body.remaining,0);
    const backInRoom=await call('rooms/join',{code:room.code},alice);assert.equal(backInRoom.body.remaining,0);
    assert.equal((await call('rooms/adopt',{},alice)).status,409);
    assert.equal((await call('start',{},alice)).status,403);
    const borrowedLogin=await call('login',{name:'bobby',password:'another-test-password'},alice);
    assert.equal(borrowedLogin.body.remaining,0);
    assert.equal((await call('start',{},borrowedLogin.cookie)).status,403);
    await call('logout',{},alice);assert.equal((await call('me',undefined,alice)).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
});

test('signing out keeps a connected guest account from returning to the next guest, and https hosting marks cookies Secure',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-signout-'));
  let server,base,cookie='';
  const open=async(oauthEnv={})=>{server=createService({directory,oauthEnv});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{await new Promise(r=>server.close(r));server=null;};
  const keep=response=>{const fresh=response.headers.getSetCookie().map(v=>v.split(';')[0]);const jar=new Map(cookie.split('; ').filter(Boolean).map(v=>v.split('=')));for(const c of fresh){const[k,v]=c.split('=');if(v)jar.set(k,v);else jar.delete(k);}cookie=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');};
  async function call(route,body){const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});keep(response);return {response,me:await response.json()};}
  try{
    await open();
    const first=await call('guest',{zone:'America/New_York'});
    assert.ok(first.response.headers.getSetCookie().every(c=>!c.includes('Secure')),'plain local http must not set Secure');
    await call('logout',{});
    assert.equal((await call('guest',{zone:'America/New_York'})).me.name,first.me.name,'an unconnected guest returns on the same device');
    await close();
    const file=path.join(directory,'store.json'),store=JSON.parse(readFileSync(file,'utf8'));
    store.users[first.me.name].connections={youtube:{display:'Someone',connectedAt:1}};writeFileSync(file,JSON.stringify(store));
    await open({PUBLIC_ORIGIN:'https://scroll.example'});
    const logout=await call('logout',{});assert.equal(logout.response.status,200);
    assert.match(logout.response.headers.get('set-cookie'),/Secure/);
    const next=await call('guest',{zone:'America/New_York'});
    assert.notEqual(next.me.name,first.me.name,'a connected guest must not be handed to the next guest');
    assert.deepEqual(next.me.connections,{});
    assert.ok(next.response.headers.getSetCookie().every(c=>c.includes('Secure')),'https public origin must set Secure');
  }finally{if(server)await close();rmSync(directory,{recursive:true,force:true});}
});
