export const platforms={
  YouTube:{url:'https://www.youtube.com/',origins:['https://www.youtube.com','https://m.youtube.com'],auth:['https://accounts.google.com','https://accounts.youtube.com']},
  Instagram:{url:'https://www.instagram.com/',origins:['https://www.instagram.com'],auth:['https://www.facebook.com']},
  TikTok:{url:'https://www.tiktok.com/foryou',origins:['https://www.tiktok.com'],auth:[]},
  Facebook:{url:'https://www.facebook.com/',origins:['https://www.facebook.com','https://m.facebook.com'],auth:[]},
  Twitch:{url:'https://www.twitch.tv/',origins:['https://www.twitch.tv'],auth:['https://id.twitch.tv']},
  Snapchat:{url:'https://www.snapchat.com/spotlight',origins:['https://www.snapchat.com','https://web.snapchat.com'],auth:['https://accounts.snapchat.com']}
};
export function allowedPlatform(platform,url,{auth=false}={}){
  const config=platforms[platform];if(!config)return false;
  try{const u=new URL(url);return !u.username&&!u.password&&([...config.origins,...(auth?config.auth:[])]).includes(u.origin);}catch{return false;}
}
