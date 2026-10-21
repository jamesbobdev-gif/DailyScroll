import {parsePost} from './content.mjs';

export function channelURL(input,tab='videos') {
  let value=String(input||'').trim();
  if(/^@[\w.-]{1,100}$/.test(value))value='https://www.youtube.com/'+value;
  if(/^UC[\w-]{22}$/.test(value))value='https://www.youtube.com/channel/'+value;
  let url;try{url=new URL(value);}catch{throw Error('Use a YouTube @handle or channel link.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))throw Error('Use a YouTube channel link.');
  const match=url.pathname.match(/^\/(@[\w.-]{1,100}|channel\/UC[\w-]{22})(?:\/(?:videos|shorts))?\/?$/);
  if(!match)throw Error('Use a YouTube @handle or channel link.');
  return `https://www.youtube.com/${match[1]}/${tab==='shorts'?'shorts':'videos'}`;
}

export function parseChannel(html,source,tab='videos') {
  const marker=/(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/g;
  const found=marker.exec(html);if(!found)throw Error('YouTube could not load this channel. Try again later.');
  const start=marker.lastIndex;let depth=0,inString=false,escaped=false,end=start;
  for(;end<html.length;end++){const c=html[end];if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;}else if(c==='"')inString=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end++;break;}}
  const data=JSON.parse(html.slice(start,end));const posts=new Map();
  const text=v=>v?.simpleText||v?.content||v?.runs?.map(r=>r.text||'').join('')||'';
  function visit(node){
    if(!node||typeof node!=='object')return;
    const old=node.videoRenderer||node.gridVideoRenderer;
    const lock=node.lockupViewModel;
    const short=node.shortsLockupViewModel;
    const id=old?.videoId||(lock?.contentType==='LOCKUP_CONTENT_TYPE_VIDEO'?lock.contentId:null)||short?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
    if(/^[\w-]{11}$/.test(id||'')){
      const title=text(old?.title)||text(lock?.metadata?.lockupMetadataViewModel?.title)||text(short?.overlayMetadata?.primaryText)||'YouTube video';
      const post=parsePost(`https://www.youtube.com/${tab==='shorts'?'shorts/':'watch?v='}${id}`);
      const author=data.metadata?.channelMetadataRenderer?.title||data.header?.pageHeaderRenderer?.pageTitle||source;
      const duration=text(old?.lengthText);
      const publishedText=text(old?.publishedTimeText);
      posts.set(id,{...post,id:'public-youtube-'+id,title,author,thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,publicSource:source,publicTab:tab,...(duration?{duration}:{}),...(publishedText?{publishedText}:{})});
    }
    for(const child of Object.values(node))if(child&&typeof child==='object')visit(child);
  }
  visit(data);return [...posts.values()].slice(0,40);
}

export function createPublicYouTube({fetcher=fetch,clock=Date.now}={}) {
  const cache=new Map();
  return async(input,tab='videos',options={})=>{
    const url=channelURL(input,tab);const cached=cache.get(url);
    if(!options.refresh&&cached&&clock()-cached.at<1800000)return cached.posts;
    let response;
    try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Accept-Language':'en-US,en;q=0.8'}});}catch{throw Error('YouTube is unavailable. Try again later.');}
    if(!response.ok)throw Error('This public channel could not load.');
    let html='',size=0;const decoder=new TextDecoder();
    for await(const part of response.body){size+=part.length;if(size>8000000)throw Error('Channel response too large.');html+=decoder.decode(part,{stream:true});}
    html+=decoder.decode();
    const posts=parseChannel(html,url.replace(/\/(videos|shorts)$/,''),tab);
    if(!posts.length)throw Error('No public videos found here. Try another channel or tab.');
    if(cache.size>=100)cache.delete(cache.keys().next().value);
    cache.set(url,{at:clock(),posts});return posts;
  };
}
