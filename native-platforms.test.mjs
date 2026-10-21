import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativePlatforms,allowedNativeNavigation,nativeAllowance} from './native-platforms.mjs';
test('all six native feeds use official HTTPS pages and reject lookalike navigation',()=>{
  for(const [platform,config] of Object.entries(nativePlatforms)){
    for(const tab of config.tabs)assert.equal(allowedNativeNavigation(platform,tab.url),true);
    for(const url of [`https://${config.host}.evil.test/`,`http://${config.host}/`,`https://user:pass@${config.host}/`,`https://${config.host}:9999/`,'intent://open','javascript:alert(1)'])assert.equal(allowedNativeNavigation(platform,url),false);
  }
  assert.equal(allowedNativeNavigation('Unknown','https://youtube.com/'),false);
});
test('native viewer expires on lease, remaining budget, or schedule closure',()=>{
  const budget={open:true,remaining:60000,allowedUntil:16000,now:1000};
  assert.equal(nativeAllowance(budget,5000),10000);
  assert.equal(nativeAllowance(budget,15000),0);
  assert.equal(nativeAllowance({...budget,remaining:4000},5000),0);
  assert.equal(nativeAllowance({...budget,open:false},0),0);

});
