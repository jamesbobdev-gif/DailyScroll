import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialYouTubeSources,mixChannelPosts,refreshYouTubeFeed} from './youtube-feed.mjs';
import {createService} from './server.mjs';
test('a new feed gets real-channel sources once; channel mixing deduplicates',()=>{
  assert.equal(initialYouTubeSources().length,3);
  assert.equal(initialYouTubeSources([],true).length,0);
  const custom=[{url:'https://www.youtube.com/@custom/videos',tab:'videos'}];
  assert.deepEqual(initialYouTubeSources(custom),custom);
  assert.deepEqual(mixChannelPosts([[{id:'a'},{id:'c'}],[{id:'b'},{id:'c'}]]).map(p=>p.id),['a','b','c']);
});
test('one unavailable channel does not erase successful channel results',async()=>{
  const result=await refreshYouTubeFeed([{url:'one',tab:'videos'},{url:'two',tab:'videos'}],async(url,tab,options)=>{assert.equal(options.refresh,true);if(url==='two')throw Error('Unavailable');return [{id:'a'}];},true);
  assert.equal(result.posts.length,1);assert.equal(result.loaded.length,1);assert.equal(result.warnings.length,1);
});
test('opening the anonymous feed fills real uploads, refreshes cached sources, and remembers removals',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-autofeed-'));let calls=0;
  const server=createService({directory,clock:()=>Date.parse('2026-10-20T00:00:00Z'),publicFetcher:async(url)=>{
    calls++;const id=url.includes('veritasium')?'11111111111':url.includes('mkbhd')?'22222222222':'33333333333';
    return new Response('var ytInitialData = '+JSON.stringify({metadata:{channelMetadataRenderer:{title:'Real channel '+id}},contents:{videoRenderer:{videoId:id,title:{simpleText:'Actual upload '+id},lengthText:{simpleText:'12:34'}}}})+';</script>');
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let cookie='';
  const call=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});return {r,data:await r.json()};};
  try{
    const guest=await call('guest',{zone:'America/New_York'});cookie=guest.r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
    const feed=await call('public/youtube/refresh',{});assert.equal(feed.r.status,200);assert.equal(feed.data.sources.length,3);assert.equal(feed.data.posts.filter(p=>p.publicSource).length,3);assert.equal(feed.data.used,0);assert.equal(feed.data.posts[0].duration,'12:34');assert.equal(calls,3);
    await call('public/youtube/refresh',{});assert.equal(calls,3);
    const source=feed.data.sources[0];await call('public/youtube/remove',{source:source.url,tab:source.tab});
    const next=await call('public/youtube/refresh',{force:true});assert.equal(next.data.sources.length,2);assert.equal(next.data.posts.some(p=>p.url.includes('11111111111')),false);assert.equal(calls,5);
    assert.equal(next.data.posts.some(p=>p.platform==='TikTok'),true);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
});
