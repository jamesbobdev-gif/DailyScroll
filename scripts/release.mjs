/* npm run release: build the Windows installer and put it on GitHub, where every installed copy picks it up
   (desktop/main.mjs checks the releases repository and updates itself). Bumps the patch version first
   (1.0.0 -> 1.0.1) in every file that carries it, since installed copies only take a version newer than
   theirs. Pass a version to set it instead: npm run release -- 1.2.0
   Needs `gh auth login` once on this computer. The installer goes to a public repository of its own
   (desktop/package.json -> build.publish): it holds installers and a README, nothing else. */
import {execSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {syncReadme,writeNotes} from './releases-readme.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const desktop=path.join(root,'desktop');
const run=(cmd,opts={})=>execSync(cmd,{cwd:root,encoding:'utf8',windowsHide:true,...opts});

const desktopPkg=JSON.parse(readFileSync(path.join(desktop,'package.json'),'utf8'));
const {owner,repo}=desktopPkg.build.publish;

let token;
try{token=run('gh auth token',{stdio:['ignore','pipe','ignore']}).trim();}catch{}
if(!token){console.error('Not signed in to GitHub. Run: gh auth login');process.exit(1);}

try{run(`gh repo view ${owner}/${repo}`,{stdio:'ignore'});}catch{
  console.log(`Making ${owner}/${repo} (public, installers only)...`);
  run(`gh repo create ${owner}/${repo} --public --description "Installers for Daily Scroll (auto-update)" --add-readme`,{stdio:'inherit'});
}

// One version number everywhere: both package.json files and their lockfiles, and the phone app's app.json.
const bump=v=>v.split('.').map(Number).map((n,i)=>i===2?n+1:n).join('.');
const version=process.argv[2]||bump(desktopPkg.version);
if(!/^\d+\.\d+\.\d+$/.test(version)){console.error('Version must look like 1.2.3, got '+version);process.exit(1);}
function setVersion(file,apply){
  const text=readFileSync(file,'utf8'),eol=text.includes('\r\n')?'\r\n':'\n';
  const data=JSON.parse(text);apply(data);
  writeFileSync(file,JSON.stringify(data,null,2).replace(/\n/g,eol)+eol);
}
setVersion(path.join(root,'package.json'),p=>{p.version=version;});
setVersion(path.join(root,'package-lock.json'),l=>{l.version=version;if(l.packages?.[''])l.packages[''].version=version;});
setVersion(path.join(desktop,'package.json'),p=>{p.version=version;});
setVersion(path.join(desktop,'package-lock.json'),l=>{l.version=version;if(l.packages?.[''])l.packages[''].version=version;});
setVersion(path.join(root,'app.json'),a=>{a.expo.version=version;});
console.log('Releasing '+version);

// the public repository's README (install steps, what the repository is) travels with each release
try{syncReadme();}catch(e){console.log('releases README not updated: '+e.message);}

run('npm run build -- --publish always',{cwd:desktop,stdio:'inherit',env:{...process.env,GH_TOKEN:token,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});

// installed copies find the new version only through latest.yml, so make sure the release has one
const tag='v'+version,dist=path.join(desktop,'dist');
const assets=()=>run(`gh release view ${tag} --repo ${owner}/${repo} --json assets --jq ".assets[].name"`).split(/\r?\n/);
if(!assets().includes('latest.yml')){
  const yml=path.join(dist,'latest.yml');
  if(!existsSync(yml)||!readFileSync(yml,'utf8').includes(`version: ${version}`)){console.error(`desktop/dist/latest.yml is not for ${version}; the release has no latest.yml, so installed copies won't update`);process.exit(1);}
  run(`gh release upload ${tag} "${yml}" --repo ${owner}/${repo}`,{stdio:'inherit'});
  console.log('latest.yml was missing from the release: attached');
}

// the SHA-256 of the installer, so a download can be checked (SECURITY.md)
const installer=`Daily-Scroll-Setup-${version}.exe`,exe=path.join(dist,installer);
if(existsSync(exe)){
  const sum=createHash('sha256').update(readFileSync(exe)).digest('hex');
  const sums=path.join(dist,'SHA256SUMS-windows.txt');writeFileSync(sums,`${sum}  ${installer}\n`);
  run(`gh release upload ${tag} "${sums}" --repo ${owner}/${repo} --clobber`,{stdio:'inherit'});
}

// the release page: say which file to download
try{writeNotes(version);}catch(e){console.log('release notes not written: '+e.message);}
console.log(`Done: ${version} is on https://github.com/${owner}/${repo}/releases. Installed Windows copies update within a few hours.`);
console.log(`Now commit the version bump and tag it: git commit -am "v${version}" && git tag v${version} && git push origin main v${version}`);
