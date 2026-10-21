import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createService} from './server.mjs';

test('no signup: device profile, saved posts and used time survive session loss',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-guest-'));
  let now=Date.parse('2026-10-20T00:00:00Z');
  const server=createService({directory,clock:()=>now,requireConnections:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(route,body,cookie=''){
    const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookies:response.headers.getSetCookie().map(v=>v.split(';')[0])};
  }
  try{
    const first=await call('guest',{zone:'America/New_York'});assert.equal(first.status,200);assert.equal(first.data.remaining,3600000);assert.equal(first.data.posts.length,2);
    const cookie=first.cookies.join('; ');const deviceOnly=first.cookies.find(v=>v.startsWith('scroll_device='));assert.ok(deviceOnly);
    await call('start',{platform:'TikTok'},cookie);now+=10000;const stopped=await call('stop',{},cookie);assert.equal(stopped.data.used,10000);
    const room=await call('rooms/create',{},cookie);assert.ok(room.data.room.code);
    const restored=await call('guest',{zone:'Pacific/Honolulu'},deviceOnly);
    assert.equal(restored.data.name,first.data.name);assert.equal(restored.data.used,10000);assert.equal(restored.data.hour,20);assert.equal(restored.data.zone,'America/New_York');assert.equal(restored.data.room.code,room.data.room.code);
    const again=await call('guest',{zone:'America/New_York'},restored.cookies.join('; '));assert.equal(again.data.used,10000);
    for(const post of first.data.posts){const embed=new URL(post.embed);assert.ok(embed.searchParams.get('mute')==='0'||embed.searchParams.get('muted')==='0');}
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
});
