import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTikTokPreview,createPublicPreviews} from './public-previews.mjs';
const url='https://www.tiktok.com/@test/video/6718335390845095173';
const html=(cover='https://p19-common-sign.tiktokcdn-us.com/image.jpg',id='6718335390845095173')=>'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id,desc:'A real caption',author:{uniqueId:'test'},video:{cover}}}}}})+'</script>';
test('TikTok previews use matching public JSON and allowlisted images, never returned scripts',()=>{
  const p=parseTikTokPreview(html(),url);assert.equal(p.title,'A real caption');assert.equal(p.author,'@test');assert.match(p.thumbnail,/tiktokcdn-us.com/);
  assert.equal(parseTikTokPreview(html('https://evil.example/image.jpg'),url).thumbnail,undefined);
  assert.equal(parseTikTokPreview(html('https://p19.tiktokcdn.com/image.jpg','6718335390845095174'),url),null);
  assert.equal(parseTikTokPreview('<html>Unavailable</html>',url),null);
  assert.throws(()=>parseTikTokPreview(html(),'https://evil.example/'));
});
test('preview fetching is restricted to parsed TikTok posts, bounded, and cached',async()=>{
  let calls=0;const load=createPublicPreviews({fetcher:async(target,options)=>{calls++;assert.equal(target,url);assert.equal(options.redirect,'error');return new Response(html());}});
  await load(url);await load(url);assert.equal(calls,1);
  assert.equal(await load('https://localhost/private'),null);assert.equal(calls,1);
  const huge=createPublicPreviews({fetcher:async()=>new Response('x'.repeat(2000001))});await assert.rejects(()=>huge(url),/too large/);
});
