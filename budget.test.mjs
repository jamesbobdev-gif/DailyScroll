import {test} from 'node:test';
import assert from 'node:assert/strict';
import {charge, dayKey, LIMIT, videoId, inWindow} from './budget.mjs';
test('daily allowance caps at one hour',()=>{const t=new Date(2026,9,19,20).getTime();assert.equal(charge({day:dayKey(new Date(t)),used:LIMIT-500},t,t+2000,20).used,LIMIT);});
test('window closes at nine',()=>{const t=new Date(2026,9,19,20,59,59).getTime();assert.equal(charge({day:dayKey(new Date(t)),used:0},t,t+3000,20).used,1000);});
test('midnight resets the allowance',()=>{const t=new Date(2026,9,19,23,59,59).getTime();assert.equal(charge({day:dayKey(new Date(t)),used:999},t,t+2000,20).used,0);});
test('validates YouTube links',()=>{assert.equal(videoId('https://youtu.be/M7lc1UVf-VE'),'M7lc1UVf-VE');assert.equal(videoId('https://evil.com/watch?v=M7lc1UVf-VE'),null);assert.equal(inWindow(new Date(2026,9,19,19),20),false);});
