// These pages load as top-level mobile WebViews, never inside third-party iframes.
export const nativePlatforms={
  YouTube:{host:'youtube.com',tabs:[{label:'Home',url:'https://m.youtube.com/'},{label:'Shorts',url:'https://m.youtube.com/shorts/'}],auth:['accounts.google.com']},
  Instagram:{host:'instagram.com',tabs:[{label:'Home',url:'https://www.instagram.com/'},{label:'Reels',url:'https://www.instagram.com/reels/'}],auth:['www.facebook.com','m.facebook.com']},
  TikTok:{host:'tiktok.com',tabs:[{label:'For You',url:'https://www.tiktok.com/foryou'},{label:'Following',url:'https://www.tiktok.com/following'}],auth:[]},
  Facebook:{host:'facebook.com',tabs:[{label:'Home',url:'https://m.facebook.com/'},{label:'Video',url:'https://www.facebook.com/watch/'}],auth:[]},
  Twitch:{host:'twitch.tv',tabs:[{label:'Discover',url:'https://www.twitch.tv/'},{label:'Following',url:'https://www.twitch.tv/directory/following'}],auth:[]},
  Snapchat:{host:'snapchat.com',tabs:[{label:'Spotlight',url:'https://www.snapchat.com/spotlight'},{label:'Snapchat',url:'https://web.snapchat.com/'}],auth:[]}
};
/** @param {string} platform @param {string} target */
export function allowedNativeNavigation(platform,target){
  const config=nativePlatforms[/** @type {keyof typeof nativePlatforms} */(platform)];if(!config)return false;
  try{const u=new URL(target);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname===config.host||u.hostname.endsWith('.'+config.host)||config.auth.some(host=>host===u.hostname));}catch{return false;}
}
/** @param {{remaining:number,allowedUntil:number,now:number,open:boolean}} budget @param {number} elapsed */
export function nativeAllowance(budget,elapsed){
  return budget.open?Math.max(0,Math.min(budget.remaining-elapsed,budget.allowedUntil-budget.now-elapsed)):0;
}
