export const PLATFORMS = ['YouTube','Instagram','TikTok','Facebook','Twitch','Snapchat'];
export function parsePost(input) {
  try {
    const u=new URL(input.trim());
    if(u.protocol!=='https:' || u.username || u.password || u.port) return null;
    const host=u.hostname.replace(/^www\./,'');
    let id;
    if(['youtube.com','m.youtube.com','youtu.be'].includes(host)) {
      id=host==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})(?:\/|$)/)?.[1];
      if(!id || !/^[\w-]{11}$/.test(id))return null;
      return {platform:'YouTube',kind:u.pathname.startsWith('/shorts/')?'short':'video',url:`https://www.youtube.com/watch?v=${id}`,embed:`https://www.youtube.com/embed/${id}?playsinline=1&fs=0&rel=0&mute=0&enablejsapi=1`};
    }
    if(host==='instagram.com') {
      const match=u.pathname.match(/^\/(p|reel|tv)\/([\w-]+)\/?$/);
      if(!match)return null;
      const url=`https://www.instagram.com/${match[1]}/${match[2]}/`;
      return {platform:'Instagram',kind:match[1]==='reel'?'short':'post',url,embed:`${url}embed/`};
    }
    if(['tiktok.com','m.tiktok.com'].includes(host)) {
      id=u.pathname.match(/^\/@[\w.]+\/(?:video|photo)\/(\d{10,25})\/?$/)?.[1];
      if(!id)return null;
      return {platform:'TikTok',kind:'short',url:`https://www.tiktok.com${u.pathname}`,embed:`https://www.tiktok.com/player/v1/${id}?autoplay=0&fullscreen_button=0&muted=0`};
    }
    if(['facebook.com','m.facebook.com'].includes(host)) {
      const isVideo=/^\/(?:[^/]+\/videos\/[^/]+|reel\/\d+)\/?$/.test(u.pathname)||u.pathname==='/watch/';
      const isPost=/^\/[^/]+\/posts\/[^/]+\/?$/.test(u.pathname)||['/permalink.php','/photo.php'].includes(u.pathname);
      if(!isVideo&&!isPost)return null;
      const clean=new URL(`https://www.facebook.com${u.pathname}`);
      for(const key of ['v','story_fbid','id','fbid'])if(u.searchParams.has(key))clean.searchParams.set(key,u.searchParams.get(key));
      return {platform:'Facebook',url:clean.href,embed:`https://www.facebook.com/plugins/${isVideo?'video':'post'}.php?href=${encodeURIComponent(clean.href)}&show_text=true&width=350`};
    }
    if(host==='twitch.tv'){
      const video=u.pathname.match(/^\/videos\/(\d+)\/?$/)?.[1];
      const channel=u.pathname.match(/^\/([a-zA-Z0-9_]{3,25})\/?$/)?.[1];
      if(!video&&(!channel||['directory','downloads','settings','search'].includes(channel.toLowerCase())))return null;
      return {platform:'Twitch',url:`https://www.twitch.tv${u.pathname}`,embed:`https://player.twitch.tv/?${video?'video=v'+video:'channel='+channel}&autoplay=false&muted=false`};
    }
    if(host==='clips.twitch.tv'){
      const clip=u.pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/)?.[1];if(!clip)return null;
      return {platform:'Twitch',url:`https://clips.twitch.tv/${clip}`,embed:`https://clips.twitch.tv/embed?clip=${clip}&autoplay=false&muted=false`};
    }
    if(host==='snapchat.com'){
      if(!/^\/(?:spotlight\/[\w-]+|p\/[\w-]+\/[\w-]+|lens\/[a-f0-9]+)\/?$/.test(u.pathname))return null;
      const url=`https://www.snapchat.com${u.pathname.replace(/\/$/,'')}`;
      return {platform:'Snapchat',url,embed:`${url}/embed`};
    }
  } catch {}
  return null;
}
