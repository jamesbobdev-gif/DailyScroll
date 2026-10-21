import {parsePost} from './content.mjs';
/** Read public JSON metadata only. Never execute page scripts or download video/audio. */
export function parseTikTokPreview(html,url){
  const post=parsePost(url);if(post?.platform!=='TikTok')throw Error('Use a full public TikTok video link.');
  const marker=html.indexOf('__UNIVERSAL_DATA_FOR_REHYDRATION__');if(marker<0)return null;
  const start=html.indexOf('>',marker)+1,end=html.indexOf('</script>',start);if(!start||end<start)return null;
  let scope;try{scope=JSON.parse(html.slice(start,end)).__DEFAULT_SCOPE__;}catch{return null;}
  const detail=scope?.['webapp.video-detail'],item=detail?.itemInfo?.itemStruct;
  if(detail?.statusCode!==0||!item||String(item.id)!==post.url.split('/').pop())return null;
  let thumbnail;
  try{
    const u=new URL(item.video?.cover||'');
    if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['tiktokcdn-us.com','tiktokcdn.com','muscdn.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))thumbnail=u.href;
  }catch{}
  return {title:String(item.desc||'TikTok video').slice(0,500),author:'@'+String(item.author?.uniqueId||'TikTok').slice(0,100),...(thumbnail?{thumbnail}:{})};
}
export function createPublicPreviews({fetcher=fetch,clock=Date.now}={}){
  const cache=new Map();
  return async(url)=>{
    const post=parsePost(url);if(post?.platform!=='TikTok')return null;
    const cached=cache.get(post.url);if(cached&&clock()-cached.at<1800000)return cached.preview;
    const r=await fetcher(post.url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Accept-Language':'en-US,en;q=0.8'}});
    if(!r.ok)return null;
    const reader=r.body?.getReader();if(!reader)return null;
    let size=0,html='';const decoder=new TextDecoder();
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('Preview response too large.');}html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}finally{reader.releaseLock();}
    const preview=parseTikTokPreview(html,post.url);
    if(cache.size>=100)cache.delete(cache.keys().next().value);
    cache.set(post.url,{at:clock(),preview});return preview;
  };
}
