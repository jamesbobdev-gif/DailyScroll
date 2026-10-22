import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {buildZip,listZip,crc32,buildCompanionZip} from './companion-zip.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
test('crc32 matches the standard check value',()=>{assert.equal(crc32(Buffer.from('123456789')),0xCBF43926);});
test('the archive lists every companion source file under one folder',()=>{
  const archive=buildCompanionZip(path.join(root,'chrome-companion'));
  const expected=readdirSync(path.join(root,'chrome-companion')).sort().map(name=>`chrome-companion/${name}`);
  assert.deepEqual(listZip(archive),expected);
  assert.ok(expected.includes('chrome-companion/manifest.json'));
  assert.equal(archive.readUInt32LE(0),0x04034b50);
});
test('entries round-trip through the local headers',()=>{
  const data=Buffer.from('a'.repeat(5000)+'daily scroll');
  const archive=buildZip([{name:'folder/file.txt',data},{name:'tiny',data:Buffer.from('x')}]);
  let cursor=0;const seen={};
  while(archive.readUInt32LE(cursor)===0x04034b50){
    const method=archive.readUInt16LE(cursor+8),crc=archive.readUInt32LE(cursor+14),size=archive.readUInt32LE(cursor+18),nameLength=archive.readUInt16LE(cursor+26);
    const name=archive.toString('utf8',cursor+30,cursor+30+nameLength),start=cursor+30+nameLength,payload=archive.subarray(start,start+size);
    const original=method===8?inflateRawSync(payload):payload;
    assert.equal(crc32(original),crc);seen[name]=original.toString();cursor=start+size;
  }
  assert.equal(seen['folder/file.txt'],data.toString());assert.equal(seen.tiny,'x');
});
test('the served archive does not depend on a prebuilt file',()=>{
  assert.ok(!readdirSync(path.join(root,'web')).includes('chrome-companion.zip'));
  assert.ok(readFileSync(path.join(root,'server.mjs'),'utf8').includes('buildCompanionZip'));
});
