import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,createReadStream,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import QRCode from 'qrcode';
import {parsePost} from './content.mjs';
import {createOAuth,PROVIDERS} from './oauth.mjs';
import {createTokenVault} from './token-vault.mjs';
import {createConnectedFeeds} from './connected-feeds.mjs';
import {createPublicYouTube,channelURL} from './public-youtube.mjs';
import {createPublicPreviews} from './public-previews.mjs';
import {initialYouTubeSources,refreshYouTubeFeed} from './youtube-feed.mjs';
import {buildCompanionZip} from './companion-zip.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
// Where the Windows installer lives: the public releases repository (desktop/package.json -> build.publish).
export const DESKTOP_RELEASES='https://github.com/jamesbobdev-gif/dailyscroll-releases/releases/latest';
// Picks the address phones on the same Wi-Fi can reach. Virtual adapters (VirtualBox, VMware, Hyper-V, WSL, Tailscale, Docker) are skipped, then 192.168.x.x wins over 172.16-31.x.x over 10.x.x.x; the VirtualBox host-only default 192.168.56.x is ranked last.
export function lanAddress(interfaces){
  const virtual=/virtualbox|vbox|vmware|hyper-v|wsl|vethernet|tailscale|docker|loopback|bluetooth|npcap|pseudo/i;
  const rank=a=>/^192\.168\.56\./.test(a)?3:a.startsWith('192.168.')?0:/^172\.(1[6-9]|2\d|3[01])\./.test(a)?1:a.startsWith('10.')?2:null;
  const found=[];
  for(const [name,list] of Object.entries(interfaces||{})){if(virtual.test(name))continue;for(const n of list||[]){if(!n||n.family!=='IPv4'||n.internal)continue;const score=rank(n.address);if(score!==null)found.push({address:n.address,score});}}
  found.sort((a,b)=>a.score-b.score);return found[0]?.address||null;
}
const HOUR=3600000;
export function createService({directory=path.join(ROOT,'data'),clock=Date.now,oauthEnv=process.env,oauthFetcher=fetch,requireConnections=false,publicFetcher=fetch,testingMode=false}={}) {
  mkdirSync(directory,{recursive:true});
  const filename=path.join(directory,'store.json');
  const db=existsSync(filename)?JSON.parse(readFileSync(filename,'utf8')):{users:{},sessions:{},rooms:{}};
  db.devices ||= {};
  db.identities ||= {};
  const oauth=createOAuth({env:oauthEnv,clock,fetcher:oauthFetcher});
  const vault=createTokenVault(directory,oauthEnv.TOKEN_ENCRYPTION_KEY);
  const previews=createPublicPreviews({fetcher:publicFetcher,clock});
  const publicYouTube=createPublicYouTube({fetcher:publicFetcher,clock});
  const feeds=createConnectedFeeds({vault,env:oauthEnv,clock,fetcher:oauthFetcher});
  for(const u of Object.values(db.users)){u.lease=0;u.last=clock();}
  const save=()=>{writeFileSync(filename+'.tmp',JSON.stringify(db),{mode:0o600});renameSync(filename+'.tmp',filename);};
  const hash=v=>createHash('sha256').update(v).digest('hex');
  let companionZip=null;
  const companionArchive=()=>companionZip||=buildCompanionZip(path.join(ROOT,'chrome-companion'));
  const random=n=>randomBytes(n).toString('hex');
  function inviteOrigin(req){
    if(process.env.PUBLIC_ORIGIN)return new URL(process.env.PUBLIC_ORIGIN).origin;
    const host=req.headers.host||'localhost:8787';
    if(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){
      const lan=lanAddress(networkInterfaces());
      if(lan)return `http://${lan}:${server.address().port}`;
    }
    return `http://${host}`;
  }
  // Cookies are HTTPS-only whenever the service is reached over HTTPS: directly, by explicit setting, or by an https:// public address.
  const secureFlag=req=>req.socket.encrypted||oauthEnv.COOKIE_SECURE==='1'||/^https:\/\//i.test(oauthEnv.PUBLIC_ORIGIN||'')?'; Secure':'';
  const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
  function local(now,zone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));const get=t=>parts.find(p=>p.type===t).value;return {day:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))};}
  function settle(u,now=clock()) {
    const here=local(now,u.zone);
    if(testingMode){const end=Math.min(now,u.lease||0);if(end>u.last)u.testingUsed=(u.testingUsed||0)+end-u.last;u.last=now;return here;}
    if(u.day!==here.day){u.day=here.day;u.used=0;u.lease=0;}
    const end=Math.min(now,u.lease||0);
    if(end>u.last)u.used=Math.min(HOUR,u.used+end-u.last);
    u.last=now;
    if(here.hour!==u.hour||u.used>=HOUR)u.lease=0;
    return here;
  }
  const roomFor=u=>u.room?db.rooms[u.room]:null;
  function roomView(u){const r=roomFor(u);return r?{code:u.room,host:r.host===u.name,hostName:r.host,members:r.members.map(name=>({name,online:clock()-(db.users[name]?.seen||0)<20000})),posts:r.posts,current:r.current,hour:r.hour,zone:r.zone}:null;}
  function view(u){const here=settle(u);u.seen=clock();return {name:u.name,guest:!!u.guest,hour:u.hour,zone:u.zone,used:u.used,testingMode,elapsed:testingMode?(u.testingUsed||0):u.used,remaining:testingMode?HOUR:Math.max(0,HOUR-u.used),open:testingMode||(here.hour===u.hour&&u.used<HOUR),allowedUntil:u.lease,now:clock(),posts:u.posts,sources:u.sources||[],youtubeStatus:u.youtubeStatus||null,connections:u.connections||{},room:roomView(u)};}
  function leave(u){const r=roomFor(u);if(r){r.members=r.members.filter(n=>n!==u.name);if(!r.members.length)delete db.rooms[u.room];else if(r.host===u.name)r.host=r.members[0];}u.room=null;}
  const attempts=new Map();
  function rate(key,max=60){const now=clock();let b=attempts.get(key);if(!b||now>b.until){b={count:0,until:now+60000};attempts.set(key,b);}if(++b.count>max)fail(429,'Too many requests. Try again in a minute.');if(attempts.size>10000)for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);}
  async function body(req){let text='';for await(const part of req){text+=part;if(text.length>16000)fail(413,'Request too large.');}try{return JSON.parse(text||'{}');}catch{fail(400,'Invalid request.');}}
  function schedule(u,hour,zone){settle(u);if(u.used>0||u.lease>clock())fail(409,'Your daily hour locks after you start scrolling. Try tomorrow.');if(!Number.isInteger(hour)||hour<0||hour>23||typeof zone!=='string')fail(400,'Choose a valid daily hour.');try{local(clock(),zone);}catch{fail(400,'Choose a valid time zone.');}u.hour=hour;u.zone=zone;u.day=local(clock(),zone).day;u.lease=0;}
  const server=http.createServer(async(req,res)=>{
    let requestUser=null,requestDevice=null;
    function mergeDevice(u,d){if(!d)return;const here=local(clock(),d.zone);if(d.day!==here.day){d.day=here.day;d.used=0;}settle(u);u.used=Math.max(u.used,d.used);requestUser=u;requestDevice=d;}
    const send=(status,data,headers={})=>{
      if(requestUser&&requestDevice){requestDevice.used=Math.max(requestDevice.used,requestUser.used);save();}
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));
    };
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health')return send(200,{ok:true});
      if(!url.pathname.startsWith('/api/')){
        if(req.method!=='GET')fail(405,'Method not allowed.');
        if(url.pathname==='/desktop-installer'){res.writeHead(302,{Location:DESKTOP_RELEASES,'Cache-Control':'no-store'});res.end();return;}
        const files={'/chrome-companion.zip':['chrome-companion.zip','application/zip'],'/mirror.js':['mirror.js','text/javascript; charset=utf-8'],'/youtube-icon.png':['youtube-icon.png','image/png'],'/tiktok-icon.png':['tiktok-icon.png','image/png'],'/':['client.html','text/html; charset=utf-8'],'/client.js':['client.js','text/javascript; charset=utf-8'],'/client.css':['client.css','text/css; charset=utf-8'],'/feed.css':['feed.css','text/css; charset=utf-8'],'/brand.css':['brand.css','text/css; charset=utf-8'],'/brand-icons.js':['brand-icons.js','text/javascript; charset=utf-8']};
        const f=files[url.pathname];if(!f)fail(404,'Not found.');
        let content;
        if(url.pathname==='/chrome-companion.zip')content=companionArchive();
        else{const file=path.join(ROOT,'web',f[0]);if(!existsSync(file))fail(404,'Not found.');content=readFileSync(file);}
        res.writeHead(200,{'Content-Type':f[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; frame-src https://www.youtube.com https://www.instagram.com https://www.tiktok.com https://www.facebook.com https://player.twitch.tv https://clips.twitch.tv https://www.snapchat.com; connect-src 'self'; img-src 'self' data: https://i.ytimg.com https://*.tiktokcdn-us.com https://*.tiktokcdn.com https://*.muscdn.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'strict-origin-when-cross-origin'});res.end(content);return;
      }
      rate(req.socket.remoteAddress,600);
      if(req.method==='POST'){
        const origin=req.headers.origin;
        if(origin&&origin!==`${req.socket.encrypted?'https':'http'}://${req.headers.host}`&&origin!==process.env.PUBLIC_ORIGIN)fail(403,'Request origin refused.');
        if(!req.headers['content-type']?.includes('application/json'))fail(415,'JSON required.');
      }
      const b=req.method==='POST'?await body(req):{};
      const token=req.headers.cookie?.match(/(?:^|;\s*)scroll_session=([a-f0-9]+)/)?.[1];
      const session=token?db.sessions[hash(token)]:null;
      let u=session&&session.expires>clock()?db.users[session.name]:null;
      const deviceToken=req.headers.cookie?.match(/(?:^|;\s*)scroll_device=([a-f0-9]+)/)?.[1];
      let deviceId=session?.deviceId||(deviceToken&&hash(deviceToken));
      if(u)mergeDevice(u,db.devices[deviceId]);
      if(url.pathname==='/api/guest'&&req.method==='POST'){
        if(u)return send(200,view(u));
        let zone=typeof b.zone==='string'?b.zone:'America/New_York';try{local(clock(),zone);}catch{zone='America/New_York';}
        let freshDevice=null;
        if(!deviceId||!db.devices[deviceId]){freshDevice=random(32);deviceId=hash(freshDevice);db.devices[deviceId]={day:local(clock(),zone).day,zone,used:0};}
        const device=db.devices[deviceId];
        const name=device.guest||`scroller_${random(4)}`;
        device.guest=name;
        u=db.users[name];
        if(!u){
          const starters=['https://www.youtube.com/watch?v=M7lc1UVf-VE','https://www.tiktok.com/@scout2015/video/6718335390845095173'].map(link=>({...parsePost(link),id:random(8)}));
          u={name,guest:true,salt:null,password:null,hour:20,zone:device.zone,day:local(clock(),device.zone).day,used:0,last:clock(),lease:0,posts:starters,room:null,connections:{}};db.users[name]=u;
        }
        mergeDevice(u,device);
        const value=random(32);db.sessions[hash(value)]={name,deviceId,expires:clock()+30*86400000};
        const secure=secureFlag(req);
        const cookies=[`scroll_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`];
        if(freshDevice)cookies.push(`scroll_device=${freshDevice}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure}`);
        save();return send(200,view(u),{'Set-Cookie':cookies});
      }
      if(url.pathname==='/api/providers'&&req.method==='GET')return send(200,oauth.status());
      if(url.pathname==='/api/oauth/prepare'&&req.method==='POST'){
        rate(`oauth:${req.socket.remoteAddress}`,20);
        let zone=typeof b.zone==='string'?b.zone:'America/New_York';try{local(clock(),zone);}catch{zone='America/New_York';}
        return send(200,oauth.prepare(b.provider,{user:u?.name||null,deviceId,zone,native:b.native===true}));
      }
      if(url.pathname==='/api/oauth/native'&&req.method==='GET'){
        const auth=oauth.consumeTicket(url.searchParams.get('ticket'));
        res.writeHead(302,{'Location':'/','Set-Cookie':auth.cookies,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return;
      }
      const oauthRoute=url.pathname.match(/^\/api\/oauth\/(youtube|instagram|tiktok|facebook|twitch|snapchat)\/(start|callback)$/);
      if(oauthRoute&&req.method==='GET'){
        const [,provider,action]=oauthRoute;
        const secure=secureFlag(req);
        if(action==='start'){
          const flow=oauth.begin(provider,url.searchParams.get('handoff'));
          res.writeHead(302,{'Location':flow.url,'Set-Cookie':`scroll_oauth=${flow.binding}; HttpOnly; SameSite=Lax; Path=/api/oauth/; Max-Age=300${secure}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return;
        }
        const result=await oauth.finish(provider,{state:url.searchParams.get('state'),code:url.searchParams.get('code'),binding:req.headers.cookie?.match(/(?:^|;\s*)scroll_oauth=([a-f0-9]+)/)?.[1]});
        const existing=db.identities[result.identity];
        if(result.user&&existing&&existing!==result.user&&!db.users[result.user]?.guest)fail(409,'This social account is already linked.');
        const name=existing||result.user||`${provider}_${result.identity.slice(0,12)}`;
        u=db.users[name];
        if(!u){u={name,salt:null,password:null,hour:20,zone:result.zone,day:local(clock(),result.zone).day,used:0,last:clock(),lease:0,posts:[],room:null,connections:{}};db.users[name]=u;}
        u.connections ||= {};u.connections[provider]={display:result.display,connectedAt:clock()};
        if(result.grant){const previous=vault.get(name,provider);vault.set(name,provider,{...result.grant,refreshToken:result.grant.refreshToken||previous?.refreshToken||null});}
        db.identities[result.identity]=name;
        deviceId=result.deviceId;let freshDevice=null;
        if(!deviceId||!db.devices[deviceId]){freshDevice=random(32);deviceId=hash(freshDevice);db.devices[deviceId]={day:local(clock(),u.zone).day,zone:u.zone,used:0};}
        mergeDevice(u,db.devices[deviceId]);
        if(db.users[result.user]?.guest)db.devices[deviceId].guest=name;
        const value=random(32);db.sessions[hash(value)]={name,deviceId,expires:clock()+30*86400000};
        const cookies=[`scroll_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`];
        if(freshDevice)cookies.push(`scroll_device=${freshDevice}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure}`);
        cookies.push(`scroll_oauth=; HttpOnly; SameSite=Lax; Path=/api/oauth/; Max-Age=0${secure}`);
        requestDevice.used=Math.max(requestDevice.used,u.used);save();
        const target=result.native?`dailyscroll://oauth?ticket=${oauth.ticket({cookies})}`:`/?connected=${provider}`;
        res.writeHead(302,{'Location':target,...(result.native?{}:{'Set-Cookie':cookies}),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return;
      }
      if(['/api/register','/api/login'].includes(url.pathname)&&req.method==='POST'){
        rate(`login:${req.socket.remoteAddress}`,10);
        const name=typeof b.name==='string'?b.name.trim().toLowerCase():'';
        if(!/^[a-z0-9_]{3,24}$/.test(name)||typeof b.password!=='string'||b.password.length<10||b.password.length>128)fail(400,'Use a 3–24 character username and a password of at least 10 characters.');
        u=db.users[name];
        if(url.pathname==='/api/register'){
          if(u)fail(409,'That username is taken.');
          const salt=random(16);const zone=typeof b.zone==='string'?b.zone:'America/New_York';
          try{local(clock(),zone);}catch{fail(400,'Invalid time zone.');}
          u={name,salt,password:scryptSync(b.password,salt,64).toString('hex'),hour:20,zone,day:local(clock(),zone).day,used:0,last:clock(),lease:0,posts:[],room:null};db.users[name]=u;
        }else if(!u?.password||!timingSafeEqual(Buffer.from(u.password,'hex'),scryptSync(b.password,u.salt,64)))fail(401,'Username or password is incorrect.');
        let newDeviceToken=null;
        if(!deviceId||!db.devices[deviceId]){newDeviceToken=random(32);deviceId=hash(newDeviceToken);db.devices[deviceId]={day:local(clock(),u.zone).day,zone:u.zone,used:0};}
        mergeDevice(u,db.devices[deviceId]);
        const value=random(32);db.sessions[hash(value)]={name,deviceId,expires:clock()+30*86400000};save();
        const secure=secureFlag(req);
        const cookies=[`scroll_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`];
        if(newDeviceToken)cookies.push(`scroll_device=${newDeviceToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure}`);
        return send(200,view(u),{'Set-Cookie':cookies});
      }
      if(!u)fail(401,'Sign in to continue.');
      settle(u);
      if(url.pathname==='/api/public/previews'&&req.method==='POST'){
        rate('previews:'+u.name,12);
        const candidates=u.posts.filter(p=>p.platform==='TikTok'&&(!p.previewCheckedAt||clock()-p.previewCheckedAt>1800000)).slice(0,6);
        await Promise.all(candidates.map(async post=>{try{const preview=await previews(post.url);if(preview)Object.assign(post,preview);post.previewCheckedAt=clock();post.previewUnavailable=!preview;}catch{post.previewCheckedAt=clock();post.previewUnavailable=true;}}));
        save();return send(200,view(u));
      }
      if(url.pathname==='/api/public/youtube/refresh'&&req.method==='POST'){
        rate('youtube-refresh:'+u.name,10);
        u.sources=initialYouTubeSources(u.sources||[],u.youtubeInitialized);
        const result=await refreshYouTubeFeed(u.sources,publicYouTube,b.force===true);
        const succeeded=new Set(result.loaded.map(s=>s.url));
        const retained=u.posts.filter(p=>!p.publicSource||!succeeded.has(channelURL(p.publicSource,p.publicTab||(p.kind==='short'?'shorts':'videos'))));
        u.posts=[...result.posts.slice(0,Math.max(0,200-retained.length)),...retained];
        u.youtubeInitialized=true;u.youtubeStatus={updatedAt:clock(),channels:result.loaded.length,warnings:result.warnings};
        save();return send(200,view(u));
      }
      if(url.pathname==='/api/public/youtube/remove'&&req.method==='POST'){
        let source;try{source=channelURL(b.source,b.tab);}catch(error){fail(400,error.message);}
        u.sources=(u.sources||[]).filter(s=>s.url!==source);
        u.posts=u.posts.filter(p=>!p.publicSource||channelURL(p.publicSource,p.publicTab||(p.kind==='short'?'shorts':'videos'))!==source);
        u.youtubeInitialized=true;save();return send(200,view(u));
      }
      if(url.pathname==='/api/public/youtube'&&req.method==='POST'){
        rate('public:'+u.name,15);
        const tab=b.tab==='shorts'?'shorts':'videos';
        let source;try{source=channelURL(b.channel,tab);}catch(error){fail(400,error.message);}
        u.sources ||= [];
        if(!u.sources.some(s=>s.url===source)&&u.sources.length>=20)fail(400,'You can add up to 20 channels.');
        let posts;try{posts=await publicYouTube(b.channel,tab);}catch(error){fail(502,error.message);}
        if(!u.sources.some(s=>s.url===source))u.sources.push({url:source,tab});
        const incoming=new Set(posts.map(p=>p.id));
        u.posts=[...posts,...u.posts.filter(p=>!incoming.has(p.id))].slice(0,200);
        save();return send(200,view(u));
      }
      const feedRoute=url.pathname.match(/^\/api\/feed\/(youtube|twitch)$/);
      if(feedRoute&&req.method==='GET'){
        const provider=feedRoute[1];if(!u.connections?.[provider])fail(403,'Connect this app first.');
        u.feedUpdatedAt ||= {};
        if(u.feedUpdatedAt[provider]&&clock()-u.feedUpdatedAt[provider]<120000)return send(200,view(u));
        try{
          const posts=await feeds.load(u.name,provider);
          u.posts=[...u.posts.filter(p=>p.platform!==PROVIDERS[provider].label||!p.imported),...posts].slice(0,200);
          u.feedUpdatedAt[provider]=clock();save();return send(200,view(u));
        }catch(error){if(error.reconnect){delete u.connections[provider];save();}throw error;}
      }
      if(url.pathname==='/api/room-qr'&&req.method==='GET'){
        if(!roomFor(u))fail(404,'Join a room first.');
        const invite=`${inviteOrigin(req)}/?room=${encodeURIComponent(u.room)}`;
        const png=await QRCode.toBuffer(invite,{type:'png',width:320,margin:3,errorCorrectionLevel:'M'});
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(png);return;
      }
      if(url.pathname==='/api/companion-folder'&&req.method==='GET')return send(200,{path:path.join(ROOT,'chrome-companion')});
      if(url.pathname==='/api/room-invite'&&req.method==='GET'){
        if(!roomFor(u))fail(404,'Join a room first.');
        return send(200,{url:`${inviteOrigin(req)}/?room=${encodeURIComponent(u.room)}`,code:u.room});
      }
      if(url.pathname==='/api/me'&&req.method==='GET')return send(200,view(u));
      if(req.method!=='POST')fail(405,'Method not allowed.');
      switch(url.pathname){
        case '/api/logout':{
          u.lease=0;if(token)delete db.sessions[hash(token)];
          // A guest with connected social accounts must not be handed back to the next guest on this device.
          const device=db.devices[deviceId];if(device?.guest===u.name&&Object.keys(u.connections||{}).length)delete device.guest;
          save();return send(200,{ok:true},{'Set-Cookie':`scroll_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureFlag(req)}`});
        }
        case '/api/schedule':schedule(u,b.hour,b.zone);break;
        case '/api/start':
        case '/api/pulse': {
          if(!view(u).open)fail(403,'Your daily scroll is closed.');
          const provider=String(b.platform||'').toLowerCase();
          if(requireConnections&&(!PROVIDERS[provider]||!u.connections?.[provider]))fail(403,'Connect this app first.');
          if(testingMode){u.lease=clock()+15000;break;}
          // Never extend beyond the next hour boundary, even during a DST transition.
          let until=clock()+15000;
          for(let t=clock();t<=until;t+=250)if(local(t,u.zone).hour!==u.hour){until=t;break;}
          u.lease=Math.min(until,clock()+HOUR-u.used);break;
        }
        case '/api/stop':u.lease=0;break;
        case '/api/posts':{
          const post=typeof b.url==='string'?parsePost(b.url):null;if(!post)fail(400,'Use the full public post or video link.');
          if(b.platform&&post.platform!==b.platform)fail(400,'Use a '+b.platform+' link here.');
          if(u.posts.length>=200)fail(400,'Your collection is full. Remove a post first.');
          if(!u.posts.some(p=>p.url===post.url))u.posts.push({...post,id:random(8)});break;
        }
        case '/api/posts/remove':u.posts=u.posts.filter(p=>p.id!==b.id);break;
        case '/api/rooms/create':{
          leave(u);const code=random(5).toUpperCase();db.rooms[code]={host:u.name,members:[u.name],posts:[...u.posts],current:0,hour:u.hour,zone:u.zone};u.room=code;break;
        }
        case '/api/rooms/join':{
          const code=String(b.code||'').trim().toUpperCase();const r=db.rooms[code];if(!r)fail(404,'Room not found. Check the invite code.');
          if(u.room===code)break;if(r.members.length>=8)fail(409,'This room is full.');
          leave(u);r.members.push(u.name);u.room=code;break;
        }
        case '/api/rooms/leave':leave(u);break;
        case '/api/rooms/adopt':{const r=roomFor(u);if(!r)fail(404,'Join a room first.');schedule(u,r.hour,r.zone);break;}
        case '/api/rooms/schedule':{const r=roomFor(u);if(!r||r.host!==u.name)fail(403,'Only the host can set the room hour.');r.hour=u.hour;r.zone=u.zone;break;}
        case '/api/rooms/add':{
          const r=roomFor(u);if(!r)fail(404,'Join a room first.');const post=u.posts.find(p=>p.id===b.id);if(!post)fail(404,'Post not found.');if(r.posts.length>=200)fail(409,'The room queue is full.');if(!r.posts.some(p=>p.url===post.url))r.posts.push({...post});break;
        }
        case '/api/rooms/current':{
          const r=roomFor(u);if(!r||r.host!==u.name)fail(403,'Only the host can change the current post.');if(!Number.isInteger(b.index)||b.index<0||b.index>=r.posts.length)fail(400,'Choose a post in this room.');r.current=b.index;break;
        }
        default:fail(404,'Not found.');
      }
      const result=view(u);save();send(200,result);
    }catch(error){
      if(!error.status)console.error(error);
      if(res.headersSent){res.destroy();return;}
      send(error.status||500,{error:error.status?error.message:'Something went wrong. Please try again.'});
    }
  });
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const testingMode=process.argv.includes('--testing')||process.env.SCROLL_TEST_MODE==='1';
  const port=Number(process.env.PORT||8787);createService({directory:process.env.SERVICE_DATA_DIR||path.join(ROOT,'data'),testingMode}).listen(port,'0.0.0.0',()=>console.log(`The Daily Scroll is running on port ${port}${testingMode?' (time limits disabled for testing)':''}. Open http://localhost:${port}`));
}


