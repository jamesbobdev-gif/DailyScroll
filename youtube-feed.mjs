import {channelURL} from './public-youtube.mjs';
export const starterChannels=['@veritasium','@mkbhd','@MarkRober'];
export function initialYouTubeSources(existing=[],initialized=false){
  const sources=existing.map(s=>({...s}));
  if(!initialized&&!sources.some(s=>s.tab==='videos')){
    for(const channel of starterChannels)if(sources.length<20)sources.push({url:channelURL(channel),tab:'videos'});
  }
  return sources;
}
/** Interleave channels so the home page is a mixed feed, rather than one channel at a time. */
export function mixChannelPosts(groups){
  const result=[],seen=new Set();
  for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups){const post=group[i];if(post&&!seen.has(post.id)){seen.add(post.id);result.push(post);}}
  return result;
}
export async function refreshYouTubeFeed(sources,load,force=false){
  const groups=[],loaded=[],warnings=[];
  for(let offset=0;offset<sources.length;offset+=4){
    const results=await Promise.allSettled(sources.slice(offset,offset+4).map(s=>load(s.url,s.tab,{refresh:force})));
    results.forEach((result,i)=>{const source=sources[offset+i];if(result.status==='fulfilled'){groups.push(result.value);loaded.push(source);}else warnings.push({source:source.url,message:result.reason?.message||'Channel unavailable.'});});
  }
  return {posts:mixChannelPosts(groups),loaded,warnings};
}
