import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('./web/mirror.js',import.meta.url),'utf8'),context);
const Mirror=context.DailyScrollMirror;
const lease={open:true,remaining:3600,now:100,allowedUntil:200};
function fixture(surface='browser'){
  class Track extends EventTarget{constructor(kind){super();this.kind=kind;this.readyState='live';}stop(){this.readyState='ended';}getSettings(){return {displaySurface:surface};}}
  const track=new Track('video'),audio=new Track('audio');let tracks=[track,audio],options,ended=0;
  const stream={getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(t=>t.kind==='video'),getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),removeTrack:t=>{tracks=tracks.filter(x=>x!==t);}};
  const video={pause(){},async play(){},srcObject:null};const wheel=[];
  const mirror=new Mirror({video,mediaDevices:{getDisplayMedia:async opts=>{options=opts;return stream;}},controllerFactory:()=>({forwardWheel:async target=>wheel.push(target)}),onEnded:()=>ended++});
  return {mirror,video,stream,track,audio,wheel,get options(){return options;},get ended(){return ended;}};
}
test('mirror discards audio and forwards wheel only for a captured tab',async()=>{
  const f=fixture();await f.mirror.start({requestLease:async()=>lease});
  assert.equal(f.options.audio,false);assert.equal(f.audio.readyState,'ended');assert.equal(f.stream.getAudioTracks().length,0);
  assert.equal(f.video.muted,true);assert.equal(f.video.volume,0);assert.equal(f.video.srcObject,f.stream);
  await f.mirror.enableScrolling();assert.equal(f.wheel.at(-1),f.video);
  f.mirror.stop();assert.equal(f.track.readyState,'ended');assert.equal(f.video.srcObject,null);
  const window=fixture('window');await window.mirror.start({requestLease:async()=>lease});
  await assert.rejects(window.mirror.enableScrolling(),/view-only/);window.mirror.stop();
});
test('capture starts immediately but budget waits for the previous stop',async()=>{
  const f=fixture();let release,requested=false;
  const beforeStart=new Promise(resolve=>release=resolve);
  const pending=f.mirror.start({beforeStart,requestLease:async()=>{requested=true;return lease;}});
  assert.ok(f.options);await Promise.resolve();assert.equal(requested,false);
  release();await pending;assert.equal(requested,true);f.mirror.stop();
});
test('denied or expired budget stops the stream',async()=>{
  for(const requestLease of [async()=>{throw Error('denied');},async()=>({...lease,remaining:0})]){
    const f=fixture();await assert.rejects(f.mirror.start({requestLease}));
    assert.equal(f.track.readyState,'ended');assert.equal(f.video.srcObject,null);assert.equal(f.mirror.active,false);
  }
});
test('ending source sharing clears the mirror and notifies the client',async()=>{
  const f=fixture();await f.mirror.start({requestLease:async()=>lease});
  f.track.dispatchEvent(new Event('ended'));assert.equal(f.ended,1);assert.equal(f.mirror.active,false);assert.equal(f.video.srcObject,null);
});
test('stop while picker is pending disposes late streams without starting a lease',async()=>{
  const f=fixture();let resolve,requested=false;
  f.mirror.mediaDevices.getDisplayMedia=()=>new Promise(r=>resolve=r);
  const pending=f.mirror.start({requestLease:async()=>{requested=true;return lease;}});
  f.mirror.stop();resolve(f.stream);await assert.rejects(pending,/cancelled/);
  assert.equal(requested,false);assert.equal(f.track.readyState,'ended');assert.equal(f.video.srcObject,null);
});
test('late budget response after stop cannot restart the preview',async()=>{
  const f=fixture();let resolve,entered;
  const ready=new Promise(r=>entered=r);
  const pending=f.mirror.start({requestLease:()=>new Promise(r=>{resolve=r;entered();})});
  await ready;f.mirror.stop();resolve(lease);
  await assert.rejects(pending,/cancelled/);assert.equal(f.video.srcObject,null);
});
