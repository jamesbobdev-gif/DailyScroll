const $=id=>document.getElementById(id);
const state={me:null,page:'choose',filter:'All',active:false,roomMode:false,current:0,post:null,lease:0,offset:0,authMode:'login',busy:false};
const symbols={YouTube:'▶',Instagram:'◎',TikTok:'♪',Facebook:'f',Twitch:'▣',Snapchat:'♧'};
state.mirroring=false;state.mirrorStarting=false;
const mirrorSession=new DailyScrollMirror({video:$('chrome-mirror'),mediaDevices:navigator.mediaDevices,controllerFactory:window.CaptureController?()=>new window.CaptureController():null,onEnded:()=>{pause();render();notice('Sharing stopped.');}});
state.youtubeChannel='all';state.youtubeLoading=false;state.youtubeError='';
state.youtubeTab='all';state.youtubeSearch='';state.videoControls=false;
async function openNativeFeed(){
  if(!window.ReactNativeWebView){pause();state.page='chrome';notice('');render();window.scrollTo(0,0);return;}
  const provider=state.filter.toLowerCase();
  if(['youtube','twitch'].includes(provider)&&state.me.connections?.[provider]){await pause();update(await api('feed/'+provider));notice(provider==='youtube'?'Subscriptions updated.':'Following updated.');return;}
  if(window.ReactNativeWebView){await pause();window.ReactNativeWebView.postMessage(JSON.stringify({type:'open-platform',platform:state.filter}));}
}
function socialHome(container,list){
  const key=JSON.stringify([state.filter,list,state.me.room?.code]);if(container.dataset.socialKey===key)return;
  container.dataset.socialKey=key;container.replaceChildren();
  const platform=state.filter;
  if(!list.length){
    const empty=document.createElement('div');empty.className='social-empty';const icon=document.createElement('div');icon.className='social-empty-icon';icon.append(platformIcon(platform));
    const title=document.createElement('h3');title.textContent='Your '+platform;const subtitle=document.createElement('p');subtitle.textContent='Open your feed, or add a public link.';
    empty.append(icon,title,subtitle,button('My feed',openNativeFeed));container.append(empty);return;
  }
  for(const p of list){
    const article=document.createElement('article');article.className='social-card';
    const author=document.createElement('div');author.className='social-author';const avatar=document.createElement('span');avatar.className='social-avatar';avatar.append(platformIcon(platform));
    const name=document.createElement('span');name.textContent=p.author||new URL(p.url).pathname.match(/\/@([^/]+)/)?.[1]||platform;
    const menu=document.createElement('details');menu.className='yt-menu';const summary=document.createElement('summary');summary.textContent='⋮';summary.setAttribute('aria-label','Post options');menu.append(summary);const actions=document.createElement('div');actions.className='yt-menu-actions';
    if(state.me.room)actions.append(button('Add to room',async()=>{update(await api('rooms/add',{id:p.id}));notice('Added.');}));
    actions.append(button('Remove',async()=>update(await api('posts/remove',{id:p.id}))));menu.append(actions);author.append(avatar,name,menu);
    const preview=button('',()=>watchPost(p));preview.className='social-preview';preview.setAttribute('aria-label','Scroll '+(p.title||platform+' post'));
    const mark=document.createElement('span');mark.className='social-preview-brand';mark.append(platformIcon(platform));const play=document.createElement('span');play.className='social-preview-play';play.textContent='▶';if(p.thumbnail){const poster=document.createElement('img');poster.className='social-poster';poster.src=p.thumbnail;poster.alt='';poster.loading='lazy';preview.append(poster);}else preview.append(mark);preview.append(play);
    const caption=document.createElement('div');caption.className='social-caption';caption.textContent=p.title||(p.kind==='short'?'Public video':'Public post');
    article.append(author,preview,caption);container.append(article);
  }
}
function youtubePosts(list){return list.filter(p=>(state.youtubeChannel==='all'||p.publicSource===state.youtubeChannel.replace(/\/(videos|shorts)$/,''))&&(state.youtubeTab==='all'||(state.youtubeTab==='shorts'?p.kind==='short':p.kind!=='short'))&&(!state.youtubeSearch||(p.title+' '+(p.author||'')).toLowerCase().includes(state.youtubeSearch.toLowerCase())));}
let youtubeRequest=null;
function refreshYouTube(force=false){
  if(youtubeRequest)return youtubeRequest;
  state.youtubeLoading=true;state.youtubeError='';render();
  youtubeRequest=(async()=>{try{const me=await api('public/youtube/refresh',{force});update(me);if(me.youtubeStatus?.warnings?.length)state.youtubeError=me.youtubeStatus.channels?'Some channels could not refresh.':'Channels are unavailable. Try Refresh.';}catch(e){state.youtubeError=e.message;}finally{state.youtubeLoading=false;youtubeRequest=null;render();}})();
  return youtubeRequest;
}
async function watchPost(p){await pause();state.roomMode=false;state.page='today';state.filter=p.platform;if(!posts().some(item=>item.id===p.id)&&p.platform==='YouTube'){state.youtubeChannel='all';state.youtubeTab='all';state.youtubeSearch='';$('youtube-search').value='';}state.current=posts().findIndex(item=>item.id===p.id);if(state.current<0)throw Error('This post is no longer available.');await start();}
function youtubeHome(container,list){
  const key=JSON.stringify([list,state.youtubeTab,state.youtubeSearch,state.me.room?.code]);if(container.dataset.youtubeKey===key)return;
  container.dataset.youtubeKey=key;container.replaceChildren();
  if(!list.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=state.youtubeSearch?'No matches.':'Add a channel to find videos.';container.append(empty);return;}
  const shorts=list.filter(p=>p.kind==='short'),videos=list.filter(p=>p.kind!=='short');
  function card(p,short=false){
    const article=document.createElement('article');article.className='yt-card'+(short?' yt-short':'');
    const cover=button('',()=>watchPost(p));cover.className='yt-cover';cover.setAttribute('aria-label','Watch '+(p.title||'YouTube video'));
    const img=document.createElement('img');img.src=p.thumbnail?.replace('/mqdefault.jpg','/hqdefault.jpg')||`https://i.ytimg.com/vi/${new URL(p.url).searchParams.get('v')}/hqdefault.jpg`;img.alt='';img.loading='lazy';cover.append(img);
    if(short){const mark=document.createElement('span');mark.className='yt-short-mark';mark.textContent='▶';cover.append(mark);}
    const meta=document.createElement('div');meta.className='yt-meta';
    const author=(p.author||'YouTube').replace('https://www.youtube.com/','');
    if(!short){const avatar=document.createElement('span');avatar.className='yt-avatar';avatar.textContent=author.replace(/^@/,'').slice(0,1).toUpperCase();meta.append(avatar);}
    const copy=document.createElement('div');copy.className='yt-copy';const title=button(p.title||'YouTube video',()=>watchPost(p));title.className='yt-title';const by=document.createElement('div');by.className='yt-author';by.textContent=author+(p.publishedText?' · '+p.publishedText:'');copy.append(title,by);if(p.duration){const duration=document.createElement('span');duration.className='yt-duration';duration.textContent=p.duration;cover.append(duration);}
    const menu=document.createElement('details');menu.className='yt-menu';const summary=document.createElement('summary');summary.textContent='⋮';summary.setAttribute('aria-label','Options for '+(p.title||'video'));menu.append(summary);
    const actions=document.createElement('div');actions.className='yt-menu-actions';
    if(state.me.room)actions.append(button('Add to room',async()=>{update(await api('rooms/add',{id:p.id}));menu.open=false;notice('Added.');}));
    actions.append(button('Remove',async()=>update(await api('posts/remove',{id:p.id}))));menu.append(actions);meta.append(copy,menu);article.append(cover,meta);return article;
  }
  for(const p of videos.slice(0,4))container.append(card(p));
  if(shorts.length){const section=document.createElement('section');section.className='yt-shorts-section';const heading=document.createElement('h3');heading.className='yt-shorts-title';heading.textContent='Shorts';const shelf=document.createElement('div');shelf.className='yt-shorts-shelf';for(const p of shorts)shelf.append(card(p,true));section.append(heading,shelf);container.append(section);}
  for(const p of videos.slice(4))container.append(card(p));
}
let lastPulse=0,polling=false,pendingStop=Promise.resolve();
let pendingInvite=new URLSearchParams(location.search).get('room');
let providers=[];
async function socialSignIn(provider){
  pause();
  const native=!!window.ReactNativeWebView;
  const target=await api('oauth/prepare',{provider,native,zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
  if(native)window.ReactNativeWebView.postMessage(JSON.stringify({type:'oauth',url:target.url}));
  else location.assign(target.url);
}
function showSignIn(){
  $('social-signin').replaceChildren();
  for(const p of providers){const b=button(`${symbols[p.label]} ${p.label}`,()=>socialSignIn(p.id));b.title=p.ready?(p.note||`Sign in with ${p.label}`):'Developer setup required';b.dataset.ready=p.ready;$('social-signin').append(b);}
}
function renderAccount(){const me=state.me,guest=!me||!!me.guest;$('account-button').hidden=!me;$('account-button').textContent=guest?'Sign in':me.name;$('account-guest').hidden=!guest;$('account-signed').hidden=guest;$('account-name').textContent=guest?'':'Signed in as '+me.name+'. Your hour, saved posts and rooms follow this account on every device.';$('auth-submit').textContent=state.authMode==='login'?'Sign in':'Create account';$('auth-toggle').textContent=state.authMode==='login'?'New here? Create an account':'Already have an account? Sign in';$('auth-password').autocomplete=state.authMode==='login'?'current-password':'new-password';}
async function submitAccount(){const name=$('auth-name').value.trim(),password=$('auth-password').value;await pause();update(await api(state.authMode,{name,password,zone:Intl.DateTimeFormat().resolvedOptions().timeZone}));$('auth-password').value='';notice(state.authMode==='login'?'Signed in as '+state.me.name+'.':'Account created. You are signed in as '+state.me.name+'.');}
async function signOut(){await pause();await api('logout',{});state.authMode='login';update(await api('guest',{zone:Intl.DateTimeFormat().resolvedOptions().timeZone}));notice('Logged out. You are scrolling as a guest on this device again.');}
function notice(message,error=false){$('notice').hidden=!message;$('notice').textContent=message;$('notice').classList.toggle('error',error);}
async function api(route,data,retry=true){const res=await fetch('/api/'+route,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const result=await res.json();if(!res.ok){if(res.status===401&&retry&&!['guest','login','register'].includes(route)){pause(false);update(await api('guest',{zone:Intl.DateTimeFormat().resolvedOptions().timeZone},false));return api(route,data,false);}throw Error(result.error||'Could not connect.');}return result;}
function update(me){const activePost=state.active&&!state.roomMode&&!state.mirroring?current()?.id:null;state.me=me;if(activePost){const index=posts().findIndex(p=>p.id===activePost);if(index>=0)state.current=index;else pause(false);}state.offset=me.now-Date.now();if(state.active){state.lease=me.allowedUntil;if(!me.open||me.allowedUntil<=me.now)pause(false);}render();}
function timeLabel(hour){return `${hour%12||12} ${hour<12?'AM':'PM'}`;}
function posts(){const all=state.roomMode?state.me.room?.posts||[]:state.me.posts;const filtered=state.filter==='All'||state.roomMode?all:all.filter(p=>p.platform===state.filter);return state.filter==='YouTube'&&!state.roomMode?youtubePosts(filtered):filtered;}
function current(){const list=posts();if(state.roomMode)return list[state.me.room?.current||0];return list[Math.min(state.current,Math.max(0,list.length-1))];}
function pause(send=true){if(state.chromeActive){state.chromeActive=false;document.dispatchEvent(new Event("daily-chrome-close"));}mirrorSession.stop();state.mirroring=false;state.active=false;if(document.fullscreenElement?.id==='mirror-screen')document.exitFullscreen?.().catch(()=>{});state.lease=0;state.post=null;$('embed-slot').replaceChildren();$('player-area').hidden=true;if(send&&state.me)pendingStop=api('stop',{}).then(me=>{if(!state.active)update(me);}).catch(()=>{});return pendingStop;}
async function start(room=false){state.roomMode=room;if(!state.me.open)throw Error('Your hour is closed.');if(room&&!state.me.room?.posts.length)throw Error('Add a post first.');if(!room&&!posts().length)throw Error('Add a post first.');state.roomMode=room;await pendingStop;try{const me=await api('start',{platform:current()?.platform});if(document.hidden){pause();return;}state.active=true;state.lease=me.allowedUntil;lastPulse=Date.now();update(me);}catch(e){pause(false);throw e;}}
function mountPost(){if(!state.active)return;const p=current();if(!p){pause();return;}if(state.post===p.id)return;state.post=p.id;state.videoControls=false;state.tapPlaying=false;$('scroll-surface').hidden=false;$('video-controls').textContent='Video controls';$('video-controls').setAttribute('aria-pressed','false');const frame=document.createElement('iframe');const embed=new URL(p.embed);if(p.platform==='Twitch'){embed.searchParams.set('parent',location.hostname);embed.searchParams.set('muted','false');}if(p.platform==='TikTok')embed.searchParams.set('muted','0');if(p.platform==='YouTube'){embed.searchParams.set('mute','0');embed.searchParams.set('enablejsapi','1');embed.searchParams.set('origin',location.origin);}frame.src=embed.href;frame.title=`${p.platform} public post`;frame.className=p.platform==='YouTube'?'youtube':'';frame.allow='autoplay; encrypted-media';frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');frame.addEventListener('error',()=>notice('This post could not load. Try the next one.',true));$('embed-slot').replaceChildren(frame);$('playing-platform').textContent=p.platform;$('room-follow').textContent=state.roomMode?(state.me.room.host?'You’re hosting':`Following ${state.me.room.hostName}`):'';}
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>run(fn);return b;}
function postList(container,list,room=false){if(container.id==='feed'&&state.filter==='YouTube'&&!state.roomMode){delete container.dataset.socialKey;youtubeHome(container,youtubePosts(list));return;}if(container.id==='feed'&&!state.roomMode&&state.filter!=='All'&&state.filter!=='YouTube'){delete container.dataset.youtubeKey;socialHome(container,list);return;}delete container.dataset.socialKey;delete container.dataset.youtubeKey;container.replaceChildren();if(!list.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No posts yet.';container.append(empty);return;}list.forEach((p,i)=>{const card=document.createElement('article');card.className='post'+(room&&state.me.room.current===i?' current':'');const symbol=document.createElement('span');symbol.className='symbol';symbol.textContent=symbols[p.platform];if(p.thumbnail){const img=document.createElement('img');img.src=p.thumbnail;img.alt='';img.loading='lazy';symbol.replaceChildren(img);symbol.classList.add('thumbnail');}const content=document.createElement('div');content.className='post-content';const title=document.createElement('div');title.className='post-title';title.textContent=p.title||p.platform;const link=document.createElement('div');link.className='post-link';link.textContent=p.author||p.url;const actions=document.createElement('div');actions.className='post-actions';if(room){if(state.me.room.host)actions.append(button('Choose for room',async()=>update(await api('rooms/current',{index:i}))));}else{actions.append(button('View',()=>watchPost(p)));if(state.me.room)actions.append(button('Add to room',async()=>{update(await api('rooms/add',{id:p.id}));notice('Added to your room.');}));actions.append(button('Remove',async()=>{if(state.post===p.id)pause();update(await api('posts/remove',{id:p.id}));}));}content.append(title,link,actions);card.append(symbol,content);container.append(card);});}
function returnToApps(send=true){pause(send);state.roomMode=false;state.page='choose';render();window.scrollTo(0,0);}
async function openPlatform(platform){await pause();state.filter=platform;state.page=!window.ReactNativeWebView?'chrome':'choose';state.roomMode=false;state.current=0;notice('');if(window.ReactNativeWebView){render();window.ReactNativeWebView.postMessage(JSON.stringify({type:'open-platform',platform}));return;}render();window.scrollTo(0,0);if(platform==='YouTube')refreshYouTube();if(platform==='TikTok'){try{update(await api('public/previews',{}));}catch{if(state.filter===platform)notice('Preview unavailable. Saved links still work.');}}}

function platformIcon(platform){
  if(platform==='YouTube'||platform==='TikTok'){
    const img=document.createElement('img');
    img.src=platform==='YouTube'?'/youtube-icon.png':'/tiktok-icon.png';
    img.alt='';img.width=51;img.height=51;img.setAttribute('aria-hidden','true');
    return img;
  }
  const namespace='http://www.w3.org/2000/svg';const svg=document.createElementNS(namespace,'svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('width','32');svg.setAttribute('height','32');svg.setAttribute('aria-hidden','true');
  const brandPath=window.brandIcons?.[platform];if(brandPath){svg.setAttribute('viewBox','0 0 24 24');const path=document.createElementNS(namespace,'path');path.setAttribute('d',brandPath);path.setAttribute('fill','currentColor');svg.append(path);return svg;}
  const paths={
    YouTube:[['M28 10c-.3-2-1.5-3-3.5-3.4C21 6 11 6 7.5 6.6 5.5 7 4.3 8 4 10c-.6 3-.6 9 0 12 .3 2 1.5 3 3.5 3.4 3.5.6 13.5.6 17 0 2-.4 3.2-1.4 3.5-3.4.6-3 .6-9 0-12Z','currentColor'],['M13 11v10l8-5Z','white']],
    Instagram:[['M10 3h12a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7V10a7 7 0 0 1 7-7Z','none','currentColor'],['M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z','none','currentColor'],['M25 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z','currentColor']],
    Twitch:[['M6 3H30v18l-8 8h-7l-5 3v-3H3V10Z','currentColor'],['M10 7h16v12l-5 5h-6l-4 3v-3h-4V10Z','white'],['M15 10h3v8h-3Zm7 0h3v8h-3Z','currentColor']],
    Snapchat:[['M16 3c-5 0-7 3-7 8v3c-2-1-4-1-4 1 0 1 2 2 3 2-1 4-3 5-5 6 0 2 3 2 5 3l1 3 4-1 3 1 3-1 4 1 1-3c2-1 5-1 5-3-2-1-4-2-5-6 1 0 3-1 3-2 0-2-2-2-4-1v-3c0-5-2-8-7-8Z','white','#181b19']]
  };
  if(!paths[platform])return document.createTextNode(symbols[platform]);
  for(const[d,fill,stroke]of paths[platform]){const p=document.createElementNS(namespace,'path');p.setAttribute('d',d);p.setAttribute('fill',fill);if(stroke){p.setAttribute('stroke',stroke);p.setAttribute('stroke-width',platform==='Snapchat'?'1.6':'2');}svg.append(p);}return svg;
}
function renderFriends(me){
  const friends=(me.room?.members||[]).filter(member=>member.name!==me.name);
  const key=JSON.stringify([friends,me.room?.hostName]);
  const list=$('friends-list');
  $('friends-empty').hidden=friends.length>0;
  $('friends-empty').textContent=me.room?'You’re the first one here. Invite a friend to your room to see them here.':'Create or join a room to see your friends here.';
  if(list.dataset.key===key)return;
  list.dataset.key=key;list.replaceChildren();
  for(const friend of friends){
    const row=document.createElement('li');row.className='friend-row';
    const avatar=document.createElement('span');avatar.className='friend-avatar';avatar.textContent=friend.name.slice(0,1).toUpperCase();avatar.setAttribute('aria-hidden','true');
    const copy=document.createElement('div');copy.className='friend-copy';
    const name=document.createElement('strong');name.textContent=friend.name;
    const status=document.createElement('span');status.className='friend-status';status.textContent=(friend.online?'Online':'Offline')+(friend.name===me.room.hostName?' · Room host':'');
    const dot=document.createElement('span');dot.className='friend-dot'+(friend.online?' online':'');dot.setAttribute('aria-hidden','true');
    copy.append(name,status);row.append(avatar,copy,dot);list.append(row);
  }
}
function render(){
  const me=state.me;
  $('signed-in').hidden=!me;$('navigation').hidden=!me;
  document.body.classList.toggle('signed',!!me);
  if(!me)return;
  renderChrome();renderAccount();
  document.body.dataset.page=state.page;
  document.body.dataset.platform=state.filter.toLowerCase();
  document.body.classList.toggle('playing',state.active);
  const playingPost=current();
  const vertical=!!playingPost&&(playingPost.kind==='short'||['TikTok','Instagram','Snapchat'].includes(playingPost.platform));
  document.body.classList.toggle('immersive',state.active&&state.page==='today');
  document.body.classList.toggle('vertical-video',vertical);
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==state.page);
  document.querySelectorAll('nav button').forEach(el=>el.classList.toggle('selected',el.dataset.page===state.page||(el.dataset.page==='choose'&&['today','connect','chrome','mirror'].includes(state.page))));
  const availability=me.testingMode?'Testing · No time limit':me.remaining<=0?'See you tomorrow':me.open?'Your hour is open':`Opens ${timeLabel(me.hour)}`;
  $('window-status').textContent=availability;$('window-status').hidden=me.open&&state.active;
  $('choose-window').textContent=me.testingMode?'Any time · Testing':me.remaining<=0?'Done for today':`${timeLabel(me.hour)}–${timeLabel((me.hour+1)%24)}`;
  $('pending-invite').hidden=!pendingInvite;
  if(!$('platform-choices').childElementCount){
  for(const p of ['YouTube','Instagram','TikTok','Facebook','Twitch','Snapchat']){
    const b=button('',()=>openPlatform(p));b.className='platform-choice '+p.toLowerCase();
    const icon=document.createElement('span');icon.className='platform-icon';icon.append(platformIcon(p));
    const name=document.createElement('span');name.className='brand-name';name.textContent=p;
    const arrow=document.createElement('span');arrow.className='choice-arrow';arrow.textContent='↗';
    const watermark=document.createElement('span');watermark.className='brand-watermark';watermark.append(platformIcon(p));b.append(icon,name,arrow,watermark);$('platform-choices').append(b);
  }
  }
  $('feed-title').textContent=state.roomMode?'With friends':state.filter;
  $('social-home-tools').hidden=state.filter==='YouTube'||state.filter==='All'||state.roomMode||state.active;
  $('native-youtube-feed').hidden=state.roomMode||state.active;
  $('social-post-url').placeholder=state.filter==='Twitch'?'Paste a channel or clip link':'Paste a '+state.filter+' post link';
  $('youtube-home-tools').hidden=state.filter!=='YouTube'||state.roomMode||state.active;
  document.querySelectorAll('[data-youtube-tab]').forEach(b=>{const selected=b.dataset.youtubeTab===state.youtubeTab;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(state.page==='connect'){
    $('connect-art').className='connect-art '+state.filter.toLowerCase();$('connect-art').replaceChildren(platformIcon(state.filter));
    $('connect-title').textContent=state.filter;$('provider-signin').textContent=`Sign in with ${state.filter}`;
  }
  const connected=!!me.connections?.[state.filter.toLowerCase()];
  $('connect-social').hidden=true;
  $('channel-form').hidden=state.filter!=='YouTube'||state.active;
  $('channel-sources').hidden=state.filter!=='YouTube'||state.active;
  $('youtube-feed-status').textContent=state.youtubeLoading?'Loading videos…':state.youtubeError;
  $('youtube-feed-status').hidden=!state.youtubeLoading&&!state.youtubeError;
  $('native-youtube-feed').disabled=state.youtubeLoading;
  const sourceKey=JSON.stringify([me.sources||[],state.youtubeChannel]);
  if($('channel-sources').dataset.key!==sourceKey){
    $('channel-sources').dataset.key=sourceKey;$('channel-sources').replaceChildren();$('youtube-channel-filter').replaceChildren();
    const all=button('All channels',()=>{state.youtubeChannel='all';state.current=0;render();});all.className=state.youtubeChannel==='all'?'selected':'';$('youtube-channel-filter').append(all);
    for(const source of me.sources||[]){
      const name=new URL(source.url).pathname.replace(/\/(videos|shorts)$/,'').replace(/^\//,'');
      const filter=button(name,()=>{state.youtubeChannel=source.url;state.current=0;render();});filter.className=state.youtubeChannel===source.url?'selected':'';$('youtube-channel-filter').append(filter);
      const row=document.createElement('div');row.className='yt-source-row';const label=document.createElement('span');label.textContent=name+' · '+(source.tab==='shorts'?'Shorts':'Videos');const remove=button('×',async()=>{update(await api('public/youtube/remove',{source:source.url,tab:source.tab}));if(state.youtubeChannel===source.url)state.youtubeChannel='all';render();});remove.setAttribute('aria-label','Remove '+name+' '+source.tab);row.append(label,remove);$('channel-sources').append(row);
    }
  }
  $('start').disabled=!me.open||!posts().length;$('start').hidden=state.active;$('stop').hidden=!state.active;$('player-area').hidden=!state.active;
  postList($('feed'),state.roomMode?(me.room?.posts||[]):state.filter==='All'?me.posts:me.posts.filter(p=>p.platform===state.filter),state.roomMode);
  $('feed').hidden=state.active;
  postList($('library-feed'),me.posts);
  
  if(document.activeElement!==$('hour'))$('hour').value=me.hour;
  if(document.activeElement!==$('zone'))$('zone').value=me.zone;
  const locked=me.used>0;$('hour').disabled=locked;$('zone').disabled=locked;$('save-hour').disabled=locked;
  $('schedule-info').textContent=me.testingMode?'Time limits are off for testing.':locked?'Locked until tomorrow.':'One hour. No extra time.';
  renderFriends(me);
  if($('invite-panel').dataset.room!==(me.room?.code||'')){$('invite-panel').hidden=true;$('invite-text').value='';$('invite-panel').dataset.room=me.room?.code||'';}
  $('no-room').hidden=!!me.room;$('has-room').hidden=!me.room;
  if(me.room){const r=me.room;$('room-title').textContent=r.code;$('members').textContent=`${r.members.length} ${r.members.length===1?'person':'people'} in this room${r.host?' · You’re hosting':''}`;$('room-hour').textContent=`${timeLabel(r.hour)}–${timeLabel((r.hour+1)%24)} · ${r.zone}`;$('publish-hour').hidden=!r.host;$('adopt-hour').disabled=locked;$('scroll-room').disabled=!me.open||!r.posts.length;postList($('room-feed'),r.posts,true);}else if(state.roomMode){pause();state.roomMode=false;}
  const guest=state.roomMode&&!me.room?.host;$('next').disabled=guest||posts().length<2;$('previous').disabled=guest||posts().length<2;
  $('post-position').textContent=state.active?`${(state.roomMode?(me.room?.current||0):state.current)+1} / ${posts().length}`:'';
  $('scroll-hint').textContent=guest?'Following room host':'Swipe up for next';
  $('mirror-setup').hidden=state.mirroring;$('mirror-live').hidden=!state.mirroring;
  const canMirror=!!navigator.mediaDevices?.getDisplayMedia&&!window.ReactNativeWebView;
  $('mirror-start').disabled=!canMirror||!me.open||state.mirrorStarting;
  $('mirror-start').textContent=state.mirrorStarting?'Choose a source in the sharing window…':'Choose Chrome tab or window';
  $('mirror-availability').textContent=!canMirror?'Open Daily Scroll in desktop Chrome to share a tab or window.':availability;
  $('mirror-scroll').hidden=!state.mirroring||!mirrorSession.canScroll;
  if(!state.mirroring){$('mirror-scroll').disabled=false;$('mirror-scroll').textContent='Enable scrolling';}
  if(state.active&&!state.mirroring)mountPost();renderClock();
}
function renderClock(){if(!state.me)return;const now=Date.now()+state.offset;const elapsed=state.active?Math.max(0,now-state.me.now):0;const remaining=Math.max(0,state.me.remaining-elapsed);const seconds=Math.ceil(remaining/1000);$('time').textContent=state.me.testingMode?formatTestingTime(state.me,now):`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('daily-remaining').textContent=$('time').textContent;$('mirror-time').textContent=$('time').textContent;$('mirror-screen-time').textContent=$('time').textContent;$('progress').style.width=`${remaining/3600000*100}%`;if(state.active&&(now>=state.lease||remaining===0)){pause();notice('Session paused.');render();}}
async function run(fn){if(state.busy)return;state.busy=true;try{await fn();}catch(e){notice(e.message||'Could not connect. Please try again.',true);}finally{state.busy=false;}}
function on(id,event,fn){$(id).addEventListener(event,e=>{e.preventDefault();run(()=>fn(e));});}
function formatTestingTime(me,now){const running=state.active||state.chromeActive;const extra=running?Math.max(0,Math.min(now-me.now,me.allowedUntil-me.now)):0;const seconds=Math.floor(((me.elapsed||0)+extra)/1000);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')+' elapsed';}
function renderChrome(){
  if(!state.me)return;
  const platform=Object.hasOwn(symbols,state.filter)?state.filter:'YouTube';
  const connected=document.documentElement.dataset.dailyChrome==='ready'&&document.documentElement.dataset.dailyChromeVersion==='0.2.1';
  $('chrome-title').textContent='Your '+platform;
  $('chrome-headline').textContent=platform+'. Yours.';
  $('chrome-limit-copy').textContent=state.me.testingMode?'Testing · No time limit':'One daily hour across all six.';
  if($('chrome-art').dataset.platform!==platform){$('chrome-art').replaceChildren(platformIcon(platform));$('chrome-art').dataset.platform=platform;}
  $('chrome-open').disabled=!connected||!state.me.open;$('chrome-open').hidden=!connected;$('chrome-choices-copy').hidden=connected;
  $('chrome-open').textContent=(state.chromeActive?'Return to ':'Open ')+platform;
  $('chrome-status').textContent=!connected?(document.documentElement.dataset.dailyChrome==='ready'?'Reload the updated companion in Chrome extensions.':'The Chrome companion is not connected yet.'):state.me.testingMode?'Chrome connected · No time limit':!state.me.open?'Available during your daily hour.':'Chrome connected · Ready';
  if(connected&&state.chromeConnected!==connected)$('chrome-install').open=false;
  state.chromeConnected=connected;
}
document.addEventListener('daily-chrome-ready',renderChrome);
document.addEventListener('daily-chrome-state',event=>{state.chromeActive=!!event.detail?.active;renderChrome();});
document.addEventListener('daily-chrome-error',event=>notice(event.detail?.message||'Could not open Chrome.',true));
on('open-real-youtube','click',()=>{pause();state.page='chrome';notice('');render();window.scrollTo(0,0);});
$('chrome-back').addEventListener('click',()=>returnToApps());
on('chrome-public','click',()=>{state.page='today';render();});
on('chrome-copy-folder','click',async()=>{const folder=await api('companion-folder');await navigator.clipboard.writeText(folder.path);notice('Companion folder copied.');});
on('chrome-open','click',async()=>{
  if(document.documentElement.dataset.dailyChromeVersion!=='0.2.1')throw Error('Connect the updated Chrome companion first.');
  if(!state.chromeActive)await pause();
  state.chromeActive=true;document.dispatchEvent(new CustomEvent('daily-chrome-open',{detail:{platform:state.filter}}));renderChrome();
});
function openMirror(){pause();state.page='mirror';state.roomMode=false;notice('');render();window.scrollTo(0,0);}
async function startMirroring(){
  if(!state.me.open)throw Error('Your daily hour is closed.');
  const stopped=pause();state.mirrorStarting=true;state.page='mirror';notice('');render();
  try{
    const me=await mirrorSession.start({beforeStart:stopped,requestLease:()=>api('start',{platform:state.filter})});
    state.mirroring=true;state.active=true;state.roomMode=false;state.lease=me.allowedUntil;lastPulse=Date.now();
    $('mirror-interaction').textContent=mirrorSession.canScroll?'Enable scrolling to use your wheel here. Click videos in the source Chrome tab.':'Live view only. Scroll and click in the source Chrome window.';
    update(me);
  }catch(e){pause();if(e.name==='NotAllowedError')notice('Sharing cancelled or not permitted.');else notice(e.message,true);}
  finally{state.mirrorStarting=false;render();}
}
on('open-youtube-mirror','click',openMirror);on('open-social-mirror','click',openMirror);
on('mirror-back','click',()=>{pause();state.page='today';notice('');render();});
on('mirror-start','click',startMirroring);
for(const id of ['mirror-stop','mirror-screen-stop'])on(id,'click',()=>{pause();render();notice('Mirror stopped.');});
on('mirror-scroll','click',async()=>{await mirrorSession.enableScrolling();$('mirror-scroll').textContent='Scrolling enabled';$('mirror-scroll').disabled=true;$('mirror-interaction').textContent='Scroll over the mirror. Click videos in the source Chrome tab.';});
on('mirror-fullscreen','click',()=>{if($('mirror-screen').requestFullscreen)return $('mirror-screen').requestFullscreen();notice('Fullscreen is unavailable here.');});

document.querySelectorAll('[data-youtube-tab]').forEach(b=>b.onclick=()=>{state.youtubeTab=b.dataset.youtubeTab;state.current=0;render();});
on('native-social-feed','click',openNativeFeed);
on('native-youtube-feed','click',()=>{refreshYouTube(true);});
on('social-add-form','submit',async()=>{update(await api('posts',{url:$('social-post-url').value,platform:state.filter}));$('social-post-url').value='';notice('');});
on('youtube-search','input',()=>{state.youtubeSearch=$('youtube-search').value;state.current=0;render();});
on('youtube-channels','click',()=>{const panel=$('youtube-channel-manager');panel.open=!panel.open;});
on('channel-form','submit',async()=>{notice('Loading…');update(await api('public/youtube',{channel:$('channel-url').value,tab:$('channel-tab').value}));$('channel-url').value='';notice('');});
on('add-form','submit',async()=>{update(await api('posts',{url:$('post-url').value}));$('post-url').value='';notice('Saved to your collection.');});
on('start','click',()=>start(state.roomMode));on('stop','click',()=>{pause();render();});
$('back-to-choose').addEventListener('click',()=>returnToApps());
on('open-library','click',()=>{pause();state.page='library';render();});
on('connect-social','click',()=>socialSignIn((current()?.platform||state.filter).toLowerCase()));
on('connect-back','click',()=>{state.page='choose';notice('');render();});
on('provider-signin','click',()=>socialSignIn(state.filter.toLowerCase()));
on('sample-posts','click',async()=>{for(const url of ['https://www.youtube.com/watch?v=M7lc1UVf-VE','https://www.tiktok.com/@scout2015/video/6718335390845095173'])update(await api('posts',{url}));notice('Sample videos added.');});
for(const[id,delta]of [['previous',-1],['next',1]])on(id,'click',()=>movePost(delta));
on('auth-form','submit',submitAccount);
on('auth-toggle','click',()=>{state.authMode=state.authMode==='login'?'register':'login';renderAccount();});
on('logout','click',signOut);
on('account-button','click',()=>{pause();state.page='settings';notice('');render();window.scrollTo(0,0);if(state.me?.guest)$('auth-name').focus();});
on('schedule-form','submit',async()=>{update(await api('schedule',{hour:Number($('hour').value),zone:$('zone').value.trim()}));notice('Your daily hour is saved.');});
on('create-room','click',async()=>update(await api('rooms/create',{})));
on('join-form','submit',async()=>{update(await api('rooms/join',{code:$('room-code').value}));notice('You joined the room.');});
on('leave-room','click',async()=>{pause();update(await api('rooms/leave',{}));});
on('adopt-hour','click',async()=>{update(await api('rooms/adopt',{}));notice('Hour matched.');});
on('publish-hour','click',async()=>{update(await api('rooms/schedule',{}));notice('Room hour updated.');});
on('scroll-room','click',async()=>{state.page='today';state.filter='All';await start(true);});
on('share-room','click',async()=>{
  const invite=await api('room-invite');
  const text=`Join my Daily Scroll room: ${invite.code}\n${invite.url}`;
  $('invite-text').value=text;$('invite-panel').hidden=false;
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'share-invite',text}));return;}
  if(navigator.share){try{await navigator.share({title:'The Daily Scroll',text});return;}catch(e){if(e.name==='AbortError')return;}}
  notice('Your invite is ready. Copy it below or share your room code.');
});
on('copy-invite','click',async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText($('invite-text').value);notice('Invite copied.');}
  catch{$('invite-text').focus();$('invite-text').select();notice('Press and hold the selected invite to copy it, or share your room code.');}
});
on('show-qr','click',()=>{const panel=$('qr-panel');panel.hidden=!panel.hidden;if(!panel.hidden)$('room-qr').src='/api/room-qr?code='+encodeURIComponent(state.me.room.code);});
on('join-invite','click',async()=>{pause();update(await api('rooms/join',{code:pendingInvite}));pendingInvite=null;history.replaceState(null,'','/');state.page='together';render();});
on('switch-room-form','submit',async()=>{pause();update(await api('rooms/join',{code:$('switch-room-code').value}));$('qr-panel').hidden=true;$('switch-room-code').value='';notice('Room joined.');});
async function movePost(delta){
  renderClock();if(!state.active)return;
  const list=posts();if(!list.length)return;
  if(state.roomMode){if(!state.me.room.host)return;update(await api('rooms/current',{index:(state.me.room.current+delta+list.length)%list.length}));}
  else{state.current=(state.current+delta+list.length)%list.length;render();}
}
let lastSwipe=0,wheelTotal=0,wheelAt=0,wheelTimer;
function scrollGesture(distance){
  if(!state.active||Math.abs(distance)<45||Date.now()-lastSwipe<650)return false;
  lastSwipe=Date.now();run(()=>movePost(distance>0?1:-1));return true;
}
for(const id of ['scroll-surface','swipe-zone','swipe-left','swipe-right']){
  let startY=null,startX=0,moved=false;
  $(id).addEventListener('touchstart',e=>{startY=e.touches[0].clientY;startX=e.touches[0].clientX;moved=false;},{passive:true});
  $(id).addEventListener('touchmove',e=>{if(startY!==null&&Math.abs(startY-e.touches[0].clientY)>10)moved=true;e.preventDefault();},{passive:false});
  $(id).addEventListener('touchcancel',()=>{startY=null;});
  $(id).addEventListener('touchend',e=>{if(startY===null)return;const dy=startY-e.changedTouches[0].clientY,dx=startX-e.changedTouches[0].clientX;startY=null;if(Math.abs(dy)>Math.abs(dx))scrollGesture(dy);},{passive:true});
  $(id).addEventListener('click',()=>{if(id!=='scroll-surface'||moved||!state.active)return;const frame=$('embed-slot').querySelector('iframe'),p=current();if(!frame)return;
    if(p.platform==='YouTube'){state.tapPlaying=!state.tapPlaying;frame.contentWindow?.postMessage(JSON.stringify({event:'command',func:state.tapPlaying?'playVideo':'pauseVideo',args:[]}),'https://www.youtube.com');}
    else if(p.platform==='TikTok'){state.tapPlaying=!state.tapPlaying;frame.contentWindow?.postMessage({'x-tiktok-player':true,type:state.tapPlaying?'play':'pause'},'https://www.tiktok.com');}
    else $('video-controls').click();
  });
}
$('player-area').addEventListener('wheel',e=>{
  if(!state.active)return;e.preventDefault();const now=Date.now();if(now-wheelAt>180)wheelTotal=0;wheelAt=now;wheelTotal+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
  clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{if(scrollGesture(wheelTotal))wheelTotal=0;},90);
},{passive:false});
on('video-controls','click',()=>{state.videoControls=!state.videoControls;$('scroll-surface').hidden=state.videoControls;$('video-controls').textContent=state.videoControls?'Swipe mode':'Video controls';$('video-controls').setAttribute('aria-pressed',String(state.videoControls));});
document.addEventListener('keydown',e=>{if(state.page!=='today'||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();run(()=>movePost(e.key==='ArrowDown'?1:-1));}});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>run(()=>{pause();state.page=b.dataset.page;render();notice('');window.scrollTo(0,0);}));
for(let h=0;h<24;h++){const o=document.createElement('option');o.value=h;o.textContent=`${timeLabel(h)} – ${timeLabel((h+1)%24)}`;$('hour').append(o);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.mirroring||state.mirrorStarting||state.chromeActive)return;pause();render();}else if(state.me)api('me').then(update).catch(e=>notice(e.message,true));});
window.addEventListener('pagehide',()=>{mirrorSession.stop();if(state.me)fetch('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});});
setInterval(()=>{renderClock();if(!state.me||(document.hidden&&!state.mirroring)||polling||(state.busy&&!state.mirroring))return;if(state.active&&Date.now()-lastPulse<5000)return;polling=true;const active=state.active;lastPulse=Date.now();api(active?'pulse':'me',active?{platform:state.mirroring?state.filter:current()?.platform}:undefined).then(me=>{if(!document.hidden||state.mirroring)update(me);}).catch(e=>{if(state.active){pause(false);render();}notice('Disconnected. Scroll paused.',true);}).finally(()=>polling=false);},2000);
api('providers').then(list=>{providers=list;showSignIn();}).catch(()=>notice('Service unavailable.',true));
api('guest',{zone:Intl.DateTimeFormat().resolvedOptions().timeZone}).then(me=>{update(me);const connected=new URLSearchParams(location.search).get('connected');const platform=Object.keys(symbols).find(p=>p.toLowerCase()===connected);if(platform&&me.connections?.[connected]){history.replaceState(null,'','/');run(()=>openPlatform(platform));}}).catch(e=>{notice('Could not connect. Refresh to retry.',true);render();});






