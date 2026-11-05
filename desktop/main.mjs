import {app,BrowserWindow,WebContentsView,ipcMain,Menu,session} from 'electron';
import {browserUserAgent} from './user-agent.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createService} from './runtime/server.mjs';
import {platforms,allowedPlatform} from './runtime/chrome-companion/platforms.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),shellURL=pathToFileURL(path.join(here,'shell.html')).href;
let window,view,service,base,cookie='',current=null,budget=null,stamp=0,error='',loading=false,busy=false,quitting=false;
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const testingMode=process.argv.includes('--testing')||process.env.SCROLL_TEST_MODE==='1';
async function call(route,body){
  const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6500)});
  const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(v=>v.split(';')[0]).join('; ');
  const me=await response.json();if(!response.ok)throw Error(me.error||'Could not connect.');return me;
}
function status(){return {platform:current,host:view&&!view.webContents.isDestroyed()?new URL(view.webContents.getURL()||platforms[current].url).hostname:'',loading,error,budget,stamp,now:Date.now()};}
function publish(){if(window&&!window.isDestroyed())window.webContents.send('daily:status',status());}
function accept(me){budget={testingMode:me.testingMode,elapsed:me.elapsed,remaining:me.remaining,open:me.open,hour:me.hour,now:me.now,allowedUntil:me.allowedUntil,locked:me.used>0||me.allowedUntil>me.now};stamp=Date.now();publish();}
function layout(){if(!view||!window)return;const [width,height]=window.getContentSize();view.setBounds({x:208,y:82,width:Math.max(1,width-208),height:Math.max(1,height-82)});}
async function stop(){
  const old=view;view=null;current=null;loading=false;
  if(old){if(window&&!window.isDestroyed())window.contentView.removeChildView(old);if(!old.webContents.isDestroyed())old.webContents.close();}
  publish();
  try{accept(await call('stop',{}));}catch{publish();}
}
async function open(platform){
  if(!Object.hasOwn(platforms,platform))throw Error('Choose an app.');
  await stop();error='';const me=await call('start',{platform});accept(me);current=platform;loading=true;
  view=new WebContentsView({webPreferences:{partition:'persist:daily-scroll-social',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,autoplayPolicy:'document-user-activation-required'}});
  const contents=view.webContents;
  contents.setUserAgent(socialUserAgent);
  contents.setAudioMuted(false);
  contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  contents.session.setPermissionCheckHandler(()=>false);
  const permitted=url=>allowedPlatform(platform,url,{auth:true});
  contents.on('will-navigate',(event,url)=>{if(!permitted(url)){event.preventDefault();error='That link leaves '+platform+'.';publish();}});
  contents.on('will-redirect',(event,url)=>{if(!permitted(url)){event.preventDefault();error='This sign-in redirect is not supported yet.';publish();}});
  contents.setWindowOpenHandler(({url})=>{if(permitted(url))contents.loadURL(url).catch(()=>{});else{error='That link opens outside '+platform+'.';publish();}return {action:'deny'};});
  contents.on('did-start-loading',()=>{loading=true;publish();});
  contents.on('did-stop-loading',()=>{loading=false;publish();});
  contents.on('did-navigate',publish);contents.on('did-navigate-in-page',publish);
  contents.on('did-fail-load',(_e,code,description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3){loading=false;error='Could not load '+platform+': '+description;publish();}});
  contents.on('render-process-gone',()=>{error='The browsing view stopped. Choose the app again.';stop();});
  window.contentView.addChildView(view);layout();publish();
  contents.loadURL(platforms[platform].url).catch(()=>{});
  return status();
}
function trusted(event){if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==shellURL)throw Error('Unsupported caller.');}
let queue=Promise.resolve();
ipcMain.handle('daily:open',(event,platform)=>{trusted(event);const next=queue.then(()=>open(platform));queue=next.catch(()=>{});return next;});
ipcMain.handle('daily:schedule',(event,hour)=>{trusted(event);if(!Number.isInteger(hour)||hour<0||hour>23)throw Error('Choose an hour.');const next=queue.then(async()=>{accept(await call('schedule',{hour,zone}));return status();});queue=next.catch(()=>{});return next;});
ipcMain.handle('daily:status',event=>{trusted(event);return status();});
ipcMain.handle('daily:navigate',async(event,action)=>{
  trusted(event);if(!['back','forward','reload','home','close'].includes(action))throw Error('Unsupported action.');
  if(action==='close'||action==='home'){await stop();return status();}if(!view)return status();
  const contents=view.webContents;
  if(action==='back'){if(contents.navigationHistory.canGoBack())contents.navigationHistory.goBack();else await stop();}
  if(action==='forward'&&contents.navigationHistory.canGoForward())contents.navigationHistory.goForward();
  if(action==='reload')contents.reload();
  return status();
});
let socialUserAgent='';
app.whenReady().then(async()=>{Menu.setApplicationMenu(null);
const social=session.fromPartition('persist:daily-scroll-social');
socialUserAgent=browserUserAgent(social.getUserAgent(),app.getName());
social.setUserAgent(socialUserAgent);
service=createService({directory:path.join(app.getPath('userData'),'allowance'),testingMode});
await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${service.address().port}`;
accept(await call('guest',{zone}));
window=new BrowserWindow({title:'DAILY SCROLL',width:1280,height:880,minWidth:800,minHeight:600,backgroundColor:'#fff',show:false,webPreferences:{preload:path.join(here,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
window.on('resize',layout);window.once('ready-to-show',()=>window.show());await window.loadFile(path.join(here,'shell.html'));
setInterval(async()=>{if(!current||busy||quitting)return;busy=true;try{accept(await call('pulse',{platform:current}));}catch(e){error=e.message;await stop();}finally{busy=false;}},4000);
setInterval(()=>{if(current&&budget&&Date.now()-stamp>=budget.allowedUntil-budget.now){error='Connection lost. Choose an app to resume.';stop();}},500);
});
app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;stop().finally(()=>service.close(()=>app.exit()));});
app.on('window-all-closed',()=>app.quit());
