import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {channelURL,parseChannel,createPublicYouTube} from './public-youtube.mjs';
import {createService} from './server.mjs';
const html='var ytInitialData = '+JSON.stringify({contents:[{videoRenderer:{videoId:'M7lc1UVf-VE',title:{runs:[{text:'A public video'}]}}},{lockupViewModel:{contentType:'LOCKUP_CONTENT_TYPE_VIDEO',contentId:'aqz-KE-bpKQ',metadata:{lockupMetadataViewModel:{title:{content:'Another video'}}}}}]})+';</script>';
test('public channels restrict hosts and paths; public JSON produces sound-enabled embeds',()=>{
  assert.equal(channelURL('@YouTube','shorts'),'https://www.youtube.com/@YouTube/shorts');
  for(const input of ['https://localhost/channel/test','https://youtube.com.evil.com/@test','https://user:pass@youtube.com/@test','https://youtube.com:444/@test','https://youtube.com/redirect?q=x','http://youtube.com/@test'])assert.throws(()=>channelURL(input));
  const posts=parseChannel(html,'@YouTube','shorts');assert.equal(posts.length,2);assert.equal(posts[0].title,'A public video');assert.equal(posts[0].kind,'short');assert.match(posts[0].embed,/mute=0/);
});
test('public channel cache avoids repeated network requests and refuses redirects',async()=>{
  let calls=0;const load=createPublicYouTube({fetcher:async(url,options)=>{calls++;assert.equal(options.redirect,'error');return new Response(html);}});
  await load('@YouTube');await load('@YouTube');assert.equal(calls,1);
});
test('anonymous public channel feeds persist and start without a platform account',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-public-'));
  const server=createService({directory,clock:()=>Date.parse('2026-10-20T00:00:00Z'),publicFetcher:async()=>new Response(html)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;let cookie='';
  const call=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {r,data:await r.json()};};
  try{
    const guest=await call('guest',{zone:'America/New_York'});cookie=guest.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    const feed=await call('public/youtube',{channel:'@YouTube',tab:'shorts'});assert.equal(feed.r.status,200);assert.equal(feed.data.sources.length,1);assert.equal(feed.data.posts[0].title,'A public video');assert.deepEqual(feed.data.connections,{});
    assert.equal((await call('start',{platform:'YouTube'})).r.status,200);
    assert.equal((await call('posts',{url:'https://youtu.be/M7lc1UVf-VE',platform:'TikTok'})).r.status,400);
    assert.equal((await call('public/youtube',{channel:'https://localhost/private'})).r.status,400);
    assert.equal((await call('me')).data.sources.length,1);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
});
