// Runs in the local app's origin, so the existing HttpOnly device cookie stays there.
(() => {
  if(location.origin!=='http://localhost:8787'||window!==top)return;
  document.documentElement.dataset.dailyChrome='ready';
  document.documentElement.dataset.dailyChromeVersion='0.2.1';
  document.dispatchEvent(new Event('daily-chrome-ready'));
  const state=active=>document.dispatchEvent(new CustomEvent('daily-chrome-state',{detail:{active}}));
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id)return;
    if(message.type==='daily-window-state'){state(message.active);respond({ok:true});return;}
    if(message.type!=='daily-budget'||!['start','pulse','stop'].includes(message.route)||!['YouTube','Instagram','TikTok','Facebook','Twitch','Snapchat'].includes(message.platform))return;
    fetch('/api/'+message.route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:message.platform}),signal:AbortSignal.timeout(7000)})
      .then(async response=>{const me=await response.json();if(!response.ok)throw Error(me.error||'Your scroll is closed.');return me;})
      .then(me=>respond({ok:true,me:{open:me.open,remaining:me.remaining,now:me.now,allowedUntil:me.allowedUntil,testingMode:me.testingMode,elapsed:me.elapsed}}),error=>respond({ok:false,error:error.message}));return true;
  });
  document.addEventListener('daily-chrome-open',async event=>{
    // Only a supported platform name is accepted, never arbitrary URLs or scripts.
    const platform=event.detail?.platform;
    if(!['YouTube','Instagram','TikTok','Facebook','Twitch','Snapchat'].includes(platform))return;
    state(true);
    try{const result=await chrome.runtime.sendMessage({type:'daily-open',platform});if(!result?.ok)throw Error(result?.error||'Could not open your app.');}
    catch(error){state(false);document.dispatchEvent(new CustomEvent('daily-chrome-error',{detail:{message:error.message}}));}
  });
  document.addEventListener('daily-chrome-close',()=>{chrome.runtime.sendMessage({type:'daily-close'}).catch(()=>{});});
})();
