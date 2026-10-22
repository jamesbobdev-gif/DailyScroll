import {readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
// Builds the Chrome companion ZIP from the extension source at request time, so a
// fresh checkout serves /chrome-companion.zip without a separate packaging step.
const CRC_TABLE=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(buffer){let c=0xFFFFFFFF;for(const byte of buffer)c=CRC_TABLE[(c^byte)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function listFiles(directory,prefix=''){
  const names=[];
  for(const entry of readdirSync(directory).sort()){
    const full=path.join(directory,entry),relative=prefix+entry;
    if(statSync(full).isDirectory())names.push(...listFiles(full,relative+'/'));else names.push(relative);
  }
  return names;
}
export function buildZip(entries){
  const locals=[],central=[];let offset=0;
  for(const {name,data} of entries){
    const nameBytes=Buffer.from(name,'utf8'),compressed=deflateRawSync(data),crc=crc32(data);
    const method=compressed.length<data.length?8:0,payload=method?compressed:data;
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(method,8);
    local.writeUInt16LE(0,10);local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(payload.length,18);local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(nameBytes.length,26);local.writeUInt16LE(0,28);
    locals.push(local,nameBytes,payload);
    const record=Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50,0);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x0800,8);record.writeUInt16LE(method,10);
    record.writeUInt16LE(0,12);record.writeUInt16LE(0x21,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(payload.length,20);record.writeUInt32LE(data.length,24);
    record.writeUInt16LE(nameBytes.length,28);record.writeUInt16LE(0,30);record.writeUInt16LE(0,32);record.writeUInt16LE(0,34);record.writeUInt16LE(0,36);record.writeUInt32LE(0,38);record.writeUInt32LE(offset,42);
    central.push(record,nameBytes);
    offset+=local.length+nameBytes.length+payload.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);
  return Buffer.concat([...locals,directory,end]);
}
export function listZip(archive){
  const endOffset=archive.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(endOffset<0)throw Error('Not a ZIP archive.');
  const count=archive.readUInt16LE(endOffset+10);let cursor=archive.readUInt32LE(endOffset+16);const names=[];
  for(let i=0;i<count;i++){
    if(archive.readUInt32LE(cursor)!==0x02014b50)throw Error('Corrupt ZIP central directory.');
    const nameLength=archive.readUInt16LE(cursor+28),extraLength=archive.readUInt16LE(cursor+30),commentLength=archive.readUInt16LE(cursor+32);
    names.push(archive.toString('utf8',cursor+46,cursor+46+nameLength));cursor+=46+nameLength+extraLength+commentLength;
  }
  return names;
}
export function buildCompanionZip(directory,folder='chrome-companion'){
  return buildZip(listFiles(directory).map(name=>({name:`${folder}/${name}`,data:readFileSync(path.join(directory,name))})));
}
