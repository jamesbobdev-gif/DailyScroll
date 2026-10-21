import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOAuth,PROVIDERS} from './oauth.mjs';

test('all six sign-in flows use official endpoints, one-time state and verified identities',async()=>{
  const env={PUBLIC_ORIGIN:'https://scroll.example'};
  for(const p of Object.values(PROVIDERS)){env[p.env+'_CLIENT_ID']='test-id';env[p.env+'_CLIENT_SECRET']='test-secret';}
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    if(Object.values(PROVIDERS).some(p=>p.token===url))return Response.json({access_token:'temporary-test-token'});
    if(url===PROVIDERS.twitch.profile)return Response.json({data:[{id:'twitch123',display_name:'Twitch user'}]});
    if(url===PROVIDERS.tiktok.profile)return Response.json({data:{user:{open_id:'tiktok123',display_name:'TikTok user'}}});
    if(url===PROVIDERS.snapchat.profile)return Response.json({data:{me:{externalId:'snap123',displayName:'Snap user'}}});
    return Response.json({sub:'google123',id:'meta123',name:'Test user'});
  };
  const oauth=createOAuth({env,fetcher});
  for(const provider of Object.keys(PROVIDERS)){
    const handoff=oauth.prepare(provider,{zone:'America/New_York',native:false});
    const start=oauth.begin(provider,new URL(handoff.url).searchParams.get('handoff'));
    const authorize=new URL(start.url);assert.ok(start.url.startsWith(PROVIDERS[provider].auth));
    assert.equal(authorize.searchParams.get('redirect_uri'),`https://scroll.example/api/oauth/${provider}/callback`);
    const args={state:authorize.searchParams.get('state'),code:'one-time-code',binding:start.binding};
    const result=await oauth.finish(provider,args);assert.equal(result.provider,provider);assert.equal(result.identity.length,64);assert.ok(!('access_token' in result));
    await assert.rejects(()=>oauth.finish(provider,args),/expired/);
    assert.throws(()=>oauth.begin(provider,new URL(handoff.url).searchParams.get('handoff')),/expired/);
  }
  assert.equal(calls.length,12);
  assert.throws(()=>createOAuth({env:{}}).prepare('youtube',{}),/setup/);
});

test('wrong browser, expired state and replayed native tickets are rejected',async()=>{
  let now=0;const env={PUBLIC_ORIGIN:'https://scroll.example',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'};
  const oauth=createOAuth({env,clock:()=>now,fetcher:()=>{throw Error('Must not call provider');}});
  const prepare=()=>{const h=oauth.prepare('youtube',{});return oauth.begin('youtube',new URL(h.url).searchParams.get('handoff'));};
  const flow=prepare();await assert.rejects(()=>oauth.finish('youtube',{state:new URL(flow.url).searchParams.get('state'),code:'code',binding:'wrong'}),/expired/);
  const expired=prepare();now+=300001;await assert.rejects(()=>oauth.finish('youtube',{state:new URL(expired.url).searchParams.get('state'),code:'code',binding:expired.binding}),/expired/);
  const ticket=oauth.ticket({cookies:['test']});assert.deepEqual(oauth.consumeTicket(ticket),{cookies:['test']});assert.throws(()=>oauth.consumeTicket(ticket),/expired/);
});
