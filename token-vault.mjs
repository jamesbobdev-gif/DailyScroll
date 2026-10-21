import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
export function createTokenVault(directory,configuredKey){
  const keyFile=path.join(directory,'oauth-key');
  let key;
  if(configuredKey){key=Buffer.from(configuredKey,'hex');if(key.length!==32)throw Error('TOKEN_ENCRYPTION_KEY must be a 32-byte hex key.');}
  else{if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});key=readFileSync(keyFile);}
  const filename=path.join(directory,'oauth-tokens.enc');
  function read(){if(!existsSync(filename))return {};const raw=readFileSync(filename);const decrypt=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decrypt.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decrypt.update(raw.subarray(28)),decrypt.final()]).toString());}
  function write(data){const iv=randomBytes(12),encrypt=createCipheriv('aes-256-gcm',key,iv);const payload=Buffer.concat([encrypt.update(JSON.stringify(data)),encrypt.final()]);writeFileSync(filename+'.tmp',Buffer.concat([iv,encrypt.getAuthTag(),payload]),{mode:0o600});renameSync(filename+'.tmp',filename);}
  return {get(user,provider){return read()[`${user}:${provider}`]||null;},set(user,provider,value){const data=read();data[`${user}:${provider}`]=value;write(data);},remove(user,provider){const data=read();delete data[`${user}:${provider}`];write(data);}};
}
