import {createHash,randomBytes} from 'node:crypto';
export const PROVIDERS={
  youtube:{label:'YouTube',env:'GOOGLE',auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',profile:'https://openidconnect.googleapis.com/v1/userinfo',scope:'openid profile https://www.googleapis.com/auth/youtube.readonly',pkce:true},
  instagram:{label:'Instagram',env:'INSTAGRAM',auth:'https://www.instagram.com/oauth/authorize',token:'https://api.instagram.com/oauth/access_token',profile:'https://graph.instagram.com/me?fields=id,username',scope:'instagram_business_basic',note:'Professional accounts only'},
  tiktok:{label:'TikTok',env:'TIKTOK',auth:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/',profile:'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',scope:'user.info.basic',clientField:'client_key',pkce:true},
  facebook:{label:'Facebook',env:'FACEBOOK',auth:'https://www.facebook.com/v26.0/dialog/oauth',token:'https://graph.facebook.com/v26.0/oauth/access_token',profile:'https://graph.facebook.com/v26.0/me?fields=id,name',scope:'public_profile'},
  twitch:{label:'Twitch',env:'TWITCH',auth:'https://id.twitch.tv/oauth2/authorize',token:'https://id.twitch.tv/oauth2/token',profile:'https://api.twitch.tv/helix/users',scope:'user:read:follows'},
  snapchat:{label:'Snapchat',env:'SNAPCHAT',auth:'https://accounts.snapchat.com/accounts/oauth2/auth',token:'https://accounts.snapchat.com/accounts/oauth2/token',profile:'https://kit.snapchat.com/v1/me',scope:'https://auth.snapchat.com/oauth2/api/user.external_id https://auth.snapchat.com/oauth2/api/user.display_name',pkce:true}
};
const digest=v=>createHash('sha256').update(v).digest('hex');
export function createOAuth({env=process.env,clock=Date.now,fetcher=fetch}={}){
  const flows=new Map(),handoffs=new Map(),tickets=new Map();
  const random=()=>randomBytes(32).toString('hex');
  const ready=p=>!!(env.PUBLIC_ORIGIN&&env[`${p.env}_CLIENT_ID`]&&env[`${p.env}_CLIENT_SECRET`]);
  const error=(status,message)=>{throw Object.assign(new Error(message),{status});};
  function prune(map){for(const[key,value]of map)if(value.expires<clock())map.delete(key);}
  function prepare(provider,context){
    const p=PROVIDERS[provider];if(!p)error(404,'Unknown platform.');if(!ready(p))error(503,'Social sign-in needs platform setup.');
    prune(handoffs);const key=random();handoffs.set(digest(key),{...context,provider,expires:clock()+60000});
    return {url:`${new URL(env.PUBLIC_ORIGIN).origin}/api/oauth/${provider}/start?handoff=${key}`};
  }
  function begin(provider,handoff){
    const p=PROVIDERS[provider];if(!p||!ready(p))error(503,'Social sign-in needs platform setup.');
    const context=handoffs.get(digest(handoff||''));handoffs.delete(digest(handoff||''));
    if(!context||context.provider!==provider||context.expires<clock())error(400,'Sign-in expired. Try again.');
    prune(flows);const state=random(),binding=random(),verifier=random();
    const redirect=`${new URL(env.PUBLIC_ORIGIN).origin}/api/oauth/${provider}/callback`;
    flows.set(digest(state),{...context,binding:digest(binding),verifier,redirect,expires:clock()+300000});
    const url=new URL(p.auth);url.searchParams.set(p.clientField||'client_id',env[`${p.env}_CLIENT_ID`]);
    url.searchParams.set('redirect_uri',redirect);url.searchParams.set('response_type','code');url.searchParams.set('state',state);
    if(p.scope)url.searchParams.set('scope',p.scope);
    if(provider==='youtube'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');url.searchParams.set('include_granted_scopes','true');}
    if(p.pkce){url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');}
    return {url:url.href,binding};
  }
  async function finish(provider,{state,code,binding}){
    const flow=flows.get(digest(state||''));flows.delete(digest(state||''));
    if(!flow||flow.provider!==provider||flow.expires<clock()||flow.binding!==digest(binding||'')||!code)error(400,'Sign-in expired or refused. Try again.');
    const p=PROVIDERS[provider];
    const params=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:flow.redirect,client_secret:env[`${p.env}_CLIENT_SECRET`],[p.clientField||'client_id']:env[`${p.env}_CLIENT_ID`]});
    if(p.pkce)params.set('code_verifier',flow.verifier);
    const tokens=await fetcher(p.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:params,signal:AbortSignal.timeout(12000)});
    const payload=await tokens.json();if(!tokens.ok||!payload.access_token)error(502,'The platform could not complete sign-in.');
    const headers={Authorization:`Bearer ${payload.access_token}`};if(provider==='twitch')headers['Client-Id']=env.TWITCH_CLIENT_ID;
    let profileUrl=p.profile,options={headers,signal:AbortSignal.timeout(12000)};
    if(provider==='instagram'){const target=new URL(profileUrl);target.searchParams.set('access_token',payload.access_token);profileUrl=target.href;}
    if(provider==='snapchat')options={...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({query:'{me{externalId displayName}}'})};
    const profile=await fetcher(profileUrl,options);const data=await profile.json();if(!profile.ok)error(502,'The platform could not verify your account.');
    const person=provider==='twitch'?data.data?.[0]:provider==='tiktok'?data.data?.user:provider==='snapchat'?data.data?.me:data;
    const subject=person?.sub||person?.open_id||person?.externalId||person?.id;
    if(!subject)error(502,'The platform did not return an account identity.');
    const grant=['youtube','twitch'].includes(provider)?{accessToken:payload.access_token,refreshToken:payload.refresh_token||null,expiresAt:clock()+(Number(payload.expires_in)||3600)*1000,subject:String(subject),scope:payload.scope||p.scope,validatedAt:clock()}:null;
    // Grant material is returned only to the service's encrypted token vault,
    // never through the public profile or a browser redirect.
    return {...flow,provider,identity:digest(provider+':'+subject),display:person.name||person.display_name||person.displayName||person.username||p.label,grant};
  }
  function ticket(session){prune(tickets);const value=random();tickets.set(digest(value),{session,expires:clock()+60000});return value;}
  function consumeTicket(value){const t=tickets.get(digest(value||''));tickets.delete(digest(value||''));if(!t||t.expires<clock())error(400,'Sign-in expired. Try again.');return t.session;}
  return {prepare,begin,finish,ticket,consumeTicket,status:()=>Object.entries(PROVIDERS).map(([id,p])=>({id,label:p.label,ready:ready(p),note:p.note||''}))};
}
