/* Keeps the README on the public installers repository (scripts/releases-readme.md) up to date through the
   GitHub API, and writes the notes on each release page. Run on its own (`node scripts/releases-readme.mjs`,
   or `node scripts/releases-readme.mjs notes 1.0.1`) or from scripts/release.mjs. Needs gh signed in. */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const pkg=JSON.parse(readFileSync(path.join(here,'..','desktop','package.json'),'utf8'));
const {owner,repo}=pkg.build.publish;
const file=path.join(here,'releases-readme.md');
const api=(args,input)=>execFileSync('gh',['api',...args],{encoding:'utf8',input,windowsHide:true});

export function syncReadme(){
  const want=readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  let sha=null;
  try{
    const current=JSON.parse(api([`repos/${owner}/${repo}/contents/README.md`]));
    if(Buffer.from(current.content,'base64').toString('utf8')===want){console.log('releases README is current');return false;}
    sha=current.sha;
  }catch{} // none yet: made below
  // sign the commit with the account's noreply address, so GitHub does not use its primary (private) email
  const who={name:'jamesbobdev-gif',email:'339323335+jamesbobdev-gif@users.noreply.github.com'};
  const body={message:'README: how to install, what this repository is',content:Buffer.from(want).toString('base64'),author:who,committer:who};
  if(sha)body.sha=sha;
  api([`repos/${owner}/${repo}/contents/README.md`,'-X','PUT','--input','-'],JSON.stringify(body));
  console.log(`releases README updated on ${owner}/${repo}`);
  return true;
}

// the notes on a release page: which of the files is the installer
export function releaseNotes(version){
  return [
    `## Windows: download **Daily-Scroll-Setup-${version}.exe** and run it`,
    '',
    'It updates an existing copy in place; your hour, saved posts and sign-ins stay.',
    'Windows shows an "unrecognized app" warning because the installer is not code-signed yet: click **More info**, then **Run anyway**.',
    '',
    `**Android**: \`Daily-Scroll-Android-${version}.apk\`, when there is a phone build for this version (open it on the phone). It needs the service running on a computer; the [README](../../#readme) says how.`,
    '',
    'Not code-signed yet, so check what you downloaded: its SHA-256 is in `SHA256SUMS-windows.txt` here (`certutil -hashfile <file> SHA256` on Windows); how-to in the [README](../../#verify-your-download).',
    '',
    'The other files are not for you: `latest.yml` and the `.blockmap` are how installed copies update themselves, and the',
    '"Source code" archives are added by GitHub and hold only this repository\'s README.',
    '',
    'What the app does and where your data lives: see the [README](../../#readme).',
  ].join('\n');
}
export function writeNotes(version){
  const v=String(version).replace(/^v/,'');
  execFileSync('gh',['release','edit','v'+v,'--repo',`${owner}/${repo}`,'--title',v,'--notes',releaseNotes(v)],{encoding:'utf8',windowsHide:true});
  console.log(`release notes written on v${v}`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='notes')writeNotes(process.argv[3]||pkg.version);else syncReadme();
}
