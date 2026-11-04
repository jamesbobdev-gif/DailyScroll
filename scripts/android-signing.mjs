import {readFile, writeFile} from 'node:fs/promises';

// Build an unsigned release for local signing. No private key enters CI.
const file = new URL('../android/app/build.gradle', import.meta.url);
let source = await readFile(file, 'utf8');
if (!/signingConfigs\s*\{/.test(source) || !/signingConfig signingConfigs\.debug/.test(source)) {
  throw new Error('Generated Gradle signing configuration changed; inspect before release.');
}
// Leave the debug variant alone; replace only the release build's signing line.
const releaseBlock = /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/;
const buildTypesIndex = source.indexOf('buildTypes');
if (buildTypesIndex < 0 || !releaseBlock.test(source.slice(buildTypesIndex))) {
  throw new Error('Release signing line missing.');
}
source = source.slice(0, buildTypesIndex) + source.slice(buildTypesIndex)
  .replace(releaseBlock, 'release {$1signingConfig null');
await writeFile(file, source);
