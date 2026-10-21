import {createCompanion,isSource} from './session.mjs';
import {allowedPlatform} from './platforms.mjs';
const companion=createCompanion({chrome});
let queue=Promise.resolve();
function serial(operation){const result=queue.then(operation);queue=result.catch(()=>{});return result;}
let heartbeatTimer;
async function ensureHeartbeat(){
  if(heartbeatTimer)return;
  const session=await companion.read();if(heartbeatTimer||!session)return;
  heartbeatTimer=setInterval(()=>{
    serial(async()=>{
      if(!await companion.read()){clearInterval(heartbeatTimer);heartbeatTimer=undefined;return;}
      // Keep the allowance alive during official login redirects too, without reading login pages.
      await companion.heartbeat();
    }).catch(()=>{});
  },4000);
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['daily-open','daily-close','daily-ready','daily-pulse','daily-stop'].includes(message?.type))return;
  serial(()=>companion.handle(message,sender)).then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message})).finally(()=>ensureHeartbeat().catch(()=>{}));return true;
});
chrome.tabs.onRemoved.addListener(id=>{serial(()=>companion.removed(id));});
chrome.tabs.onUpdated.addListener((id,change)=>{
  if(!change.url)return;
  serial(async()=>{const s=await companion.read();if(!s)return;
    if(id===s.sourceTabId&&!isSource(change.url))await companion.stop('Keep Daily Scroll open.');
    if(id===s.tabId){
      if(!allowedPlatform(s.platform,change.url,{auth:true}))await companion.stop('You left your app.');
    }
  });
});
chrome.alarms.create('daily-supervisor',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='daily-supervisor')serial(()=>companion.supervise()).then(ensureHeartbeat).catch(()=>{});});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:'http://localhost:8787/'}));
ensureHeartbeat();
