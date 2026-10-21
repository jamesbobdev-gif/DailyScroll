import {PROVIDERS} from './oauth.mjs';
import {parsePost} from './content.mjs';
import {createHash} from 'node:crypto';
export function createConnectedFeeds({vault,env=process.env,clock=Date.now,fetcher=fetch}){
  const pending=new Map();
  const validatedThisProcess=new Set();
  const expired=()=>Object.assign(new Error('Connect this app again.'),{status:403,reconnect:true});
  async function token(user,provider,force=false){
    let grant=vault.get(user,provider);if(!grant)throw expired();
    if(force||grant.expiresAt<=clock()+60000){
      if(!grant.refreshToken)throw expired();
      const p=PROVIDERS[provider];
      const response=await fetcher(p.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:grant.refreshToken,client_id:env[p.env+'_CLIENT_ID'],client_secret:env[p.env+'_CLIENT_SECRET']}),signal:AbortSignal.timeout(12000)});
      const data=await response.json();
      if(!response.ok||!data.access_token){if(response.status===400||response.status===401){vault.remove(user,provider);throw expired();}throw Object.assign(new Error('The platform is unavailable. Try again.'),{status:502});}
      grant={...grant,accessToken:data.access_token,refreshToken:data.refresh_token||grant.refreshToken,expiresAt:clock()+(Number(data.expires_in)||3600)*1000,validatedAt:0};vault.set(user,provider,grant);validatedThisProcess.delete(`${user}:${provider}`);
    }
    return grant;
  }
  async function request(user,provider,url,retried=false){
    let grant=await token(user,provider);
    if(provider==='twitch'&&(!validatedThisProcess.has(`${user}:${provider}`)||clock()-grant.validatedAt>=3600000)){
      const validation=await fetcher('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${grant.accessToken}`},signal:AbortSignal.timeout(12000)});
      if(validation.status===401&&!retried){await token(user,provider,true);return request(user,provider,url,true);}
      if(!validation.ok)throw Object.assign(new Error('Twitch is unavailable.'),{status:502});
      const identity=await validation.json();
      if(identity.client_id!==env.TWITCH_CLIENT_ID||identity.user_id!==grant.subject){vault.remove(user,provider);throw expired();}
      grant={...grant,validatedAt:clock()};vault.set(user,provider,grant);validatedThisProcess.add(`${user}:${provider}`);
    }
    const headers={Authorization:`Bearer ${grant.accessToken}`};if(provider==='twitch')headers['Client-Id']=env.TWITCH_CLIENT_ID;
    const response=await fetcher(url,{headers,signal:AbortSignal.timeout(12000)});
    if(response.status===401){if(retried){vault.remove(user,provider);throw expired();}await token(user,provider,true);return request(user,provider,url,true);}
    if(!response.ok)throw Object.assign(new Error('Could not load your feed. Try again.'),{status:502});return response.json();
  }
  const post=(url,extra)=>{const parsed=parsePost(url);return parsed?{...parsed,...extra,id:'feed_'+createHash('sha256').update(parsed.url).digest('hex').slice(0,16),imported:true}:null;};
  async function load(user,provider){
    if(provider==='twitch'){
      const grant=await token(user,provider);
      const feed=await request(user,provider,`https://api.twitch.tv/helix/streams/followed?user_id=${encodeURIComponent(grant.subject)}&first=30`);
      return (feed.data||[]).map(item=>post(`https://www.twitch.tv/${item.user_login}`,{title:item.title,author:item.user_name,live:true})).filter(Boolean);
    }
    if(provider==='youtube'){
      const subscriptions=await request(user,provider,'https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=12&order=relevance');
      const ids=(subscriptions.items||[]).map(item=>item.snippet?.resourceId?.channelId).filter(Boolean);
      if(!ids.length)return [];
      const channels=await request(user,provider,`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(ids.join(','))}`);
      const uploads=(channels.items||[]).map(item=>item.contentDetails?.relatedPlaylists?.uploads).filter(Boolean);
      const items=[];
      // Bound API usage; never scrape YouTube Home or the Shorts recommendation feed.
      for(const playlist of uploads){
        const videos=await request(user,provider,`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlist)}&maxResults=3`);
        for(const item of videos.items||[]){const s=item.snippet;if(s?.resourceId?.videoId){const p=post(`https://www.youtube.com/watch?v=${s.resourceId.videoId}`,{title:s.title,author:s.videoOwnerChannelTitle||s.channelTitle,publishedAt:s.publishedAt});if(p)items.push(p);}}
      }
      return [...new Map(items.sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt))).map(p=>[p.id,p])).values()].slice(0,36);
    }
    throw Object.assign(new Error('This feed is not supported yet.'),{status:400});
  }
  return {load(user,provider){const key=`${user}:${provider}`;if(pending.has(key))return pending.get(key);const work=load(user,provider).finally(()=>pending.delete(key));pending.set(key,work);return work;}};
}
