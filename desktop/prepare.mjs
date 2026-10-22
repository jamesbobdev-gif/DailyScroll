import {readdir,copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),runtime=path.join(here,'runtime');
await mkdir(runtime,{recursive:true});
for(const file of await readdir(root))if(file.endsWith('.mjs')&&!file.endsWith('.test.mjs'))await copyFile(path.join(root,file),path.join(runtime,file));
await mkdir(path.join(runtime,'chrome-companion'),{recursive:true});
for(const file of await readdir(path.join(root,'chrome-companion')))await copyFile(path.join(root,'chrome-companion',file),path.join(runtime,'chrome-companion',file));
