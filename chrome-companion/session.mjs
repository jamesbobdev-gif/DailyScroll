import {platforms,allowedPlatform} from './platforms.mjs';
export function isSource(url){try{const u=new URL(url);return !u.username&&!u.password&&u.origin==='http://localhost:8787';}catch{return false;}}
export function isYouTube(url){try{return new URL(url).origin==='https://www.youtube.com';}catch{return false;}}
export function leaseView(me,now=Date.now()){
  if(!me?.open||!Number.isFinite(me.remaining)||!Number.isFinite(me.now)||!Number.isFinite(me.allowedUntil)||me.remaining<=0||me.allowedUntil<=me.now)throw Error('Your daily hour is closed.');
  return {remaining:me.remaining,deadline:now+Math.min(15000,me.remaining,me.allowedUntil-me.now),received:now,testingMode:me.testingMode===true,elapsed:Number.isFinite(me.elapsed)?me.elapsed:0};
}
// Dependency injection keeps browser-window and budget behavior testable without real accounts.
export function createCompanion({chrome,clock=Date.now}){
  const read=async()=> (await chrome.storage.session.get('dailyWindow')).dailyWindow;
  const save=dailyWindow=>chrome.storage.session.set({dailyWindow});
  async function budget(sourceTabId,route,platform='YouTube'){
    const source=await chrome.tabs.get(sourceTabId);
    if(!isSource(source.url))throw Error('Keep Daily Scroll open in Chrome.');
    let timeout;
    try{
      const result=await Promise.race([chrome.tabs.sendMessage(sourceTabId,{type:'daily-budget',route,platform}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Daily Scroll is not responding.')),8000);})]);
      if(!result?.ok)throw Error(result?.error||'Daily Scroll is not responding.');
      return result.me;
    }finally{clearTimeout(timeout);}
  }
  async function notify(sourceTabId,active){try{await chrome.tabs.sendMessage(sourceTabId,{type:'daily-window-state',active});}catch{}}
  async function stop(reason='Your scroll is paused.'){
    const session=await read();if(!session)return;
    await chrome.storage.session.remove('dailyWindow');
    try{await chrome.tabs.update(session.tabId,{muted:true,url:chrome.runtime.getURL('closed.html')+'?reason='+encodeURIComponent(reason)});}catch{}
    await budget(session.sourceTabId,'stop',session.platform).catch(()=>{});await notify(session.sourceTabId,false);
  }
  async function handle(message,sender){
    if(sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.tab)throw Error('Unsupported sender.');
    const tabId=sender.tab.id;
    if(message.type==='daily-close'){
      const existing=await read();if(!isSource(sender.url)||existing?.sourceTabId!==tabId)throw Error('Unsupported sender.');
      await stop();return {active:false};
    }
    if(message.type==='daily-open'){
      if(!isSource(sender.url))throw Error('Open this from Daily Scroll in Chrome.');
      const platform=message.platform||'YouTube';
      if(!Object.hasOwn(platforms,platform))throw Error('Choose a supported app.');
      const existing=await read();
      if(existing){if(existing.platform===platform){try{await chrome.tabs.get(existing.tabId);await chrome.windows.update(existing.windowId,{focused:true});return {active:true};}catch{await stop();}}else await stop('Switching apps.');}
      const lease=leaseView(await budget(tabId,'start',platform),clock());let win;
      try{
        // Open with sound enabled; site and browser controls remain available.
        win=await chrome.windows.create({url:'about:blank',type:'popup',width:1280,height:900,focused:true});
        const target=win?.tabs?.[0];if(!Number.isInteger(target?.id))throw Error('Could not open your app window.');
        await save({sourceTabId:tabId,tabId:target.id,windowId:win.id,platform,lease});
        await chrome.tabs.update(target.id,{muted:false});
        await chrome.tabs.update(target.id,{url:platforms[platform].url});
        await notify(tabId,true);return {active:true};
      }catch(error){if(await read())await stop();else{if(win)await chrome.windows.remove(win.id).catch(()=>{});await budget(tabId,'stop',platform).catch(()=>{});}throw error;}
    }
    const session=await read();
    if(!session||session.tabId!==tabId||!allowedPlatform(session.platform,sender.url))throw Error('This is not a Daily Scroll window.');
    if(message.type==='daily-stop'){await stop();return {active:false};}
    if(!['daily-ready','daily-pulse'].includes(message.type))throw Error('Unsupported operation.');
    return renew(session);
  }
  async function renew(session){
    try{
      if(clock()>=session.lease.deadline)throw Error('Sharing allowance expired. Reopen from Daily Scroll.');
      const renewed=await budget(session.sourceTabId,'pulse',session.platform);
      if(clock()>=session.lease.deadline)throw Error('Your scroll paused while reconnecting.');
      session.lease=leaseView(renewed,clock());
      await save(session);return session.lease;
    }catch(error){await stop(error.message);throw error;}
  }
  async function removed(tabId){const s=await read();if(s&&(tabId===s.tabId||tabId===s.sourceTabId))await stop('Daily Scroll was closed.');}
  async function supervise(){const s=await read();if(s&&clock()>=s.lease.deadline)await stop('Your scroll is paused.');}
  async function heartbeat(){
    const session=await read();if(!session)return;
    try{const tab=await chrome.tabs.get(session.tabId);if(!allowedPlatform(session.platform,tab.url,{auth:true}))throw Error('You left your app.');return await renew(session);}
    catch(error){await stop(error.message);throw error;}
  }
  return {handle,removed,supervise,heartbeat,stop,read};
}
