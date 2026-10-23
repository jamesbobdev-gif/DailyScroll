import test from 'node:test';
import assert from 'node:assert/strict';
import {browserUserAgent} from './user-agent.mjs';
const electron='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) daily-scroll-desktop/0.3.0 Chrome/152.0.7977.167 Electron/44.9.2 Safari/537.36';
test('the social view presents itself as plain Chrome',()=>{
  const ua=browserUserAgent(electron,'daily-scroll-desktop');
  assert.equal(ua,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.167 Safari/537.36');
  assert.doesNotMatch(ua,/electron|daily-scroll/i);
});
test('a user agent without app tokens is left alone',()=>{
  const chrome='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
  assert.equal(browserUserAgent(chrome,'daily-scroll-desktop'),chrome);
  assert.equal(browserUserAgent(undefined),'');
});
