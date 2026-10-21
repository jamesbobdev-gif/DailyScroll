(() => {
  let host,shadow,time,lease,closed=false,polling=false;
  const displayClock=new DailyScrollClock();
  function mute(){for(const video of document.querySelectorAll('video,audio')){if(!video.muted)video.muted=true;if(video.volume!==0)video.volume=0;}}
  function build(){
    if(host?.isConnected)return;
    host=document.createElement('daily-scroll-bar');shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');style.textContent=':host{all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;font:13px Arial,sans-serif;color:#fff}section{display:flex;align-items:center;gap:20px;background:#17191b;border:1px solid #ffffff30;box-shadow:0 4px 24px #0004;border-radius:40px;padding:10px 12px 10px 20px}b{font-size:11px;letter-spacing:.5px}span{font-variant-numeric:tabular-nums;font-size:15px}button{font:12px Arial,sans-serif;cursor:pointer;background:white;color:#17191b;border:0;border-radius:20px;padding:10px 15px}small{color:#aaa;font-size:10px}';
    const bar=document.createElement('section'),brand=document.createElement('b');brand.textContent='DAILY SCROLL';time=document.createElement('span');time.textContent='…';
    const stop=document.createElement('button');stop.textContent='Stop';stop.onclick=()=>end();
    bar.append(brand,time,stop);shadow.append(style,bar);(document.body||document.documentElement).append(host);
  }
  async function end(){if(closed)return;closed=true;mute();for(const video of document.querySelectorAll('video,audio'))video.pause();
    // Block immediately, including when the service or extension is unavailable.
    if(!host?.isConnected)build();
    const cover=document.createElement('div');cover.textContent='Your scroll is paused. Reopen from Daily Scroll.';
    cover.style.cssText='position:fixed;inset:0;background:#fff;color:#17191b;display:grid;place-items:center;font:18px Arial;z-index:2147483647';shadow.append(cover);
    document.documentElement.style.setProperty('overflow','hidden','important');
    try{await chrome.runtime.sendMessage({type:'daily-stop'});}catch{}
  }
  async function pulse(type){if(polling||closed)return;polling=true;
    try{const result=await chrome.runtime.sendMessage({type});if(!result?.ok)throw Error(result?.error);lease={...result.value,monotonic:performance.now()};displayClock.accept(lease);build();time.textContent=displayClock.text();}
    catch{if(host)await end();}finally{polling=false;}
  }
  // Normal social tabs are left alone; only a window created by the companion is managed.
  pulse('daily-ready').then(()=>{if(!lease)return;
    new MutationObserver(()=>{build();}).observe(document.documentElement,{childList:true,subtree:true});

    setInterval(()=>{if(closed)return;const elapsed=performance.now()-lease.monotonic,validFor=lease.deadline-lease.received;
      if(elapsed>=validFor){end();return;}time.textContent=displayClock.text();},250);
    setInterval(()=>pulse('daily-pulse'),4000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&performance.now()-lease.monotonic>=lease.deadline-lease.received)end();});
  });
})();

