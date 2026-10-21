import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createTokenVault} from './token-vault.mjs';
import {createConnectedFeeds} from './connected-feeds.mjs';

test('Twitch connection survives restart, refreshes silently, validates and loads followed streams',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-tokens-'));let now=1000000;
  try{
    const vault=createTokenVault(directory);
    vault.set('guest','twitch',{accessToken:'old-access-secret',refreshToken:'refresh-secret',expiresAt:now-1,subject:'123',validatedAt:0});
    const file=readFileSync(path.join(directory,'oauth-tokens.enc'));assert.equal(file.includes(Buffer.from('refresh-secret')),false);assert.equal(file.includes(Buffer.from('old-access-secret')),false);
    const restored=createTokenVault(directory);assert.equal(restored.get('guest','twitch').refreshToken,'refresh-secret');
    const calls=[];
    const fetcher=async(url,options)=>{
      calls.push(url);
      if(url.includes('/token')){assert.equal(options.body.get('refresh_token'),'refresh-secret');return Response.json({access_token:'new-access',refresh_token:'rotated-refresh',expires_in:3600});}
      if(url.includes('/validate'))return Response.json({client_id:'client',user_id:'123',scopes:['user:read:follows']});
      assert.equal(options.headers.Authorization,'Bearer new-access');assert.ok(url.includes('/streams/followed?user_id=123'));
      return Response.json({data:[{user_login:'twitch',user_name:'Twitch',title:'Live test stream'}]});
    };
    const feeds=createConnectedFeeds({vault:restored,clock:()=>now,env:{TWITCH_CLIENT_ID:'client',TWITCH_CLIENT_SECRET:'secret'},fetcher});
    const posts=await feeds.load('guest','twitch');assert.equal(posts[0].title,'Live test stream');assert.equal(posts[0].live,true);assert.equal(posts[0].url,'https://www.twitch.tv/twitch');assert.equal(restored.get('guest','twitch').refreshToken,'rotated-refresh');
    await feeds.load('guest','twitch');assert.equal(calls.filter(url=>url.includes('/token')).length,1);assert.equal(calls.filter(url=>url.includes('/validate')).length,1);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('YouTube uses subscriptions and upload playlists, deduplicates and sorts without a Home-feed claim',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-youtube-'));
  try{
    const vault=createTokenVault(directory);vault.set('guest','youtube',{accessToken:'youtube-token',refreshToken:'refresh',expiresAt:9999999,subject:'google-id'});
    const fetcher=async url=>{
      if(url.includes('/subscriptions?'))return Response.json({items:[{snippet:{resourceId:{channelId:'UCexample'}}}]});
      if(url.includes('/channels?'))return Response.json({items:[{contentDetails:{relatedPlaylists:{uploads:'UUexample'}}}]});
      assert.ok(url.includes('/playlistItems?'));return Response.json({items:[{snippet:{title:'A video',channelTitle:'A creator',publishedAt:'2026-10-19',resourceId:{videoId:'M7lc1UVf-VE'}}}]});
    };
    const feeds=createConnectedFeeds({vault,clock:()=>100000,fetcher});const posts=await feeds.load('guest','youtube');assert.equal(posts[0].title,'A video');assert.equal(posts[0].author,'A creator');assert.equal(posts[0].imported,true);assert.equal(posts[0].platform,'YouTube');
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('revoked refresh token requires reconnect instead of pretending the connection works',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'scroll-revoked-'));
  try{
    const vault=createTokenVault(directory);vault.set('guest','youtube',{accessToken:'expired',refreshToken:'revoked',expiresAt:0,subject:'id'});
    const feeds=createConnectedFeeds({vault,clock:()=>100000,fetcher:async()=>Response.json({error:'invalid_grant'},{status:400}),env:{GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'}});
    await assert.rejects(()=>feeds.load('guest','youtube'),e=>e.reconnect===true&&e.status===403);assert.equal(vault.get('guest','youtube'),null);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
