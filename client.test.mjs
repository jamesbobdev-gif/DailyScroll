import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const client=readFileSync(new URL('./web/client.js',import.meta.url),'utf8');
function playbackContext(){
  const selected={id:'selected',platform:'YouTube',title:'Chosen video',publicSource:'https://www.youtube.com/@chosen',kind:'video'};
  const other={id:'other',platform:'YouTube',title:'Other video',publicSource:'https://www.youtube.com/@other',kind:'video'};
  const input={value:'Other'};let played;
  const state={me:{posts:[other,selected]},filter:'YouTube',roomMode:false,youtubeChannel:'https://www.youtube.com/@other',youtubeTab:'shorts',youtubeSearch:'Other'};
  const context=vm.createContext({state,$:()=>input,pause:async()=>{},start:async()=>{played=context.posts()[state.current]?.id;}});
  for(const name of ['youtubePosts','posts','watchPost']){
    const source=client.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('));
    vm.runInContext(source,context);
  }
  return {context,state,selected,input,played:()=>played};
}
test('opening a saved YouTube post clears filters that hide it and plays that exact post',async()=>{
  const f=playbackContext();await f.context.watchPost(f.selected);
  assert.equal(f.played(),'selected');assert.equal(f.state.youtubeChannel,'all');assert.equal(f.state.youtubeTab,'all');assert.equal(f.state.youtubeSearch,'');assert.equal(f.input.value,'');
});
test('opening a visible filtered post preserves its filters and waits for the old session to stop',async()=>{
  const f=playbackContext();f.state.youtubeChannel=f.selected.publicSource;f.state.youtubeTab='videos';f.state.youtubeSearch='Chosen';
  let finishStop;f.context.pause=()=>new Promise(resolve=>{finishStop=resolve;});
  const playing=f.context.watchPost(f.selected);assert.equal(f.played(),undefined);finishStop();await playing;
  assert.equal(f.played(),'selected');assert.equal(f.state.youtubeChannel,f.selected.publicSource);assert.equal(f.state.youtubeSearch,'Chosen');
});
test('a removed post reports an error instead of playing another video',async()=>{
  const f=playbackContext();f.state.me.posts=[];
  await assert.rejects(()=>f.context.watchPost(f.selected),/no longer available/);assert.equal(f.played(),undefined);
});
test('companion leaves playing audio alone but silences and pauses it when its lease expires',async()=>{
  const intervals=[],media={muted:false,volume:0.6,paused:false,pause(){this.paused=true;}};let now=0;
  function element(){return {isConnected:true,style:{setProperty(){}},append(){},attachShadow(){return element();}};}
  const root=element();
  const context=vm.createContext({document:{createElement:element,body:root,documentElement:root,querySelectorAll:()=>[media],addEventListener(){}},
    chrome:{runtime:{sendMessage:async({type})=>type==='daily-stop'?{ok:true}:{ok:true,value:{deadline:15000,received:0}}}},
    DailyScrollClock:class {accept(){}text(){return '60:00';}},MutationObserver:class {observe(){}},
    performance:{now:()=>now},setInterval:(fn,ms)=>intervals.push({fn,ms})});
  vm.runInContext(readFileSync(new URL('./chrome-companion/social.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const tick=intervals.find(item=>item.ms===250).fn;
  now=1000;tick();assert.equal(media.muted,false);assert.equal(media.volume,0.6);assert.equal(media.paused,false);
  now=15001;tick();assert.equal(media.muted,true);assert.equal(media.volume,0);assert.equal(media.paused,true);
});

test('resuming a paused room keeps following the room selection rather than starting a personal feed',async()=>{
  const roomPosts=[{id:'room-youtube',platform:'YouTube'},{id:'room-tiktok',platform:'TikTok'}];
  const state={roomMode:true,active:false,filter:'All',current:0,me:{open:true,posts:[{id:'personal',platform:'YouTube'}],room:{posts:roomPosts,current:1,host:false}}};
  const requests=[],handlers={};
  const context=vm.createContext({state,pendingStop:Promise.resolve(),document:{hidden:false},lastPulse:0,
    on:(id,event,fn)=>{handlers[id]=fn;},api:async(route,body)=>{requests.push({route,...body});return {...state.me,allowedUntil:Date.now()+15000};},update:me=>{state.me=me;},pause:()=>{},render:()=>{}});
  for(const name of ['posts','current','start']){
    vm.runInContext(client.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'(')),context);
  }
  vm.runInContext(client.split('\n').find(line=>line.startsWith("on('start','click'")),context);
  await handlers.start();
  assert.equal(state.roomMode,true);assert.equal(state.active,true);assert.equal(requests[0].platform,'TikTok');assert.equal(context.current().id,'room-tiktok');
  state.roomMode=false;state.active=false;await handlers.start();
  assert.equal(state.roomMode,false);assert.equal(requests[1].platform,'YouTube');assert.equal(context.current().id,'personal');
});

test('All apps exits immediately even while a request is busy',()=>{
  for(const id of ['back-to-choose','chrome-back']){
    const handlers={};let paused=0,rendered='';
    const state={page:'today',roomMode:true,active:true,busy:true};
    const context=vm.createContext({state,$:()=>({addEventListener:(event,fn)=>handlers[event]=fn}),pause:()=>{paused++;state.active=false;return new Promise(()=>{});},render:()=>{rendered=state.page;},window:{scrollTo(){}}});
    vm.runInContext(client.split('\n').find(line=>line.startsWith('function returnToApps(')),context);
    vm.runInContext(client.split('\n').find(line=>line.startsWith("$('"+id+"').addEventListener")),context);
    handlers.click();assert.equal(paused,1);assert.equal(state.active,false);assert.equal(state.roomMode,false);assert.equal(rendered,'choose');
  }
});
test('opening the native YouTube view leaves the app picker ready underneath',async()=>{
  let rendered='',message;
  const state={page:'today',roomMode:true};
  const context=vm.createContext({state,pause:async()=>{},notice:()=>{},render:()=>{rendered=state.page;},window:{ReactNativeWebView:{postMessage:value=>{message=JSON.parse(value);}}}});
  vm.runInContext(client.split('\n').find(line=>line.startsWith('async function openPlatform(')),context);
  await context.openPlatform('YouTube');assert.equal(rendered,'choose');assert.equal(state.roomMode,false);assert.equal(message.type,'open-platform');assert.equal(message.platform,'YouTube');
});
test('the account form signs in or creates an account, and logging out returns to a guest profile',async()=>{
  const requests=[],fields={'auth-name':{value:' Alice '},'auth-password':{value:'a-real-test-password'}};let noticed='';
  const state={authMode:'register',me:{name:'scroller_1',guest:true}};
  const context=vm.createContext({state,Intl,$:id=>fields[id],pause:async()=>{},notice:m=>{noticed=m;},update:me=>{state.me=me;},api:async(route,body)=>{requests.push({route,...body});return route==='logout'?{ok:true}:{name:route==='guest'?'scroller_1':body.name,guest:route==='guest'};}});
  for(const name of ['submitAccount','signOut'])vm.runInContext(client.split('\n').find(line=>line.startsWith('async function '+name+'(')),context);
  await context.submitAccount();
  assert.equal(requests[0].route,'register');assert.equal(requests[0].name,'Alice');assert.equal(requests[0].password,'a-real-test-password');assert.ok(requests[0].zone);
  assert.equal(state.me.name,'Alice');assert.equal(state.me.guest,false);assert.equal(fields['auth-password'].value,'');assert.match(noticed,/Alice/);
  state.authMode='login';fields['auth-password'].value='a-real-test-password';await context.submitAccount();assert.equal(requests[1].route,'login');
  await context.signOut();assert.deepEqual(requests.slice(2).map(r=>r.route),['logout','guest']);assert.equal(state.me.guest,true);assert.equal(state.authMode,'login');assert.match(noticed,/guest/);
  const elements={};const el=id=>elements[id]||=({});
  const view=vm.createContext({state:{authMode:'login',me:{name:'alice',guest:false}},$:el});
  vm.runInContext(client.split('\n').find(line=>line.startsWith('function renderAccount(')),view);
  view.renderAccount();assert.equal(el('account-button').hidden,false);assert.equal(el('account-button').textContent,'alice');assert.equal(el('account-guest').hidden,true);assert.equal(el('account-signed').hidden,false);assert.match(el('account-name').textContent,/alice/);
  view.state.me={name:'scroller_2',guest:true};view.renderAccount();assert.equal(el('account-button').textContent,'Sign in');assert.equal(el('account-guest').hidden,false);assert.equal(el('auth-submit').textContent,'Sign in');
});
