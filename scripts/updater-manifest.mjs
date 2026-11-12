// Builds latest.json for tauri-plugin-updater from the signed bundles of a
// release: `node scripts/updater-manifest.mjs <dist dir> <tag> <owner/repo>`.
// Platforms without a .sig (no signing key in CI) are skipped.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dist, tag, repo] = process.argv.slice(2);
if (!dist || !tag || !repo) {
  console.error('usage: updater-manifest.mjs <dist> <tag> <owner/repo>');
  process.exit(1);
}

const files = readdirSync(dist);
const platforms = {};
const add = (platform, file) => {
  const sig = `${file}.sig`;
  if (!existsSync(join(dist, sig))) return;
  platforms[platform] = {
    signature: readFileSync(join(dist, sig), 'utf8').trim(),
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(file)}`,
  };
};

for (const file of files) {
  if (file.endsWith('-setup.exe')) add('windows-x86_64', file);
  else if (file.endsWith('_darwin-aarch64.app.tar.gz')) add('darwin-aarch64', file);
  else if (file.endsWith('_darwin-x86_64.app.tar.gz')) add('darwin-x86_64', file);
}

if (Object.keys(platforms).length === 0) {
  console.warn('No signed bundles found: latest.json is not written (set TAURI_SIGNING_PRIVATE_KEY).');
  process.exit(0);
}

const manifest = {
  version: tag.replace(/^v/, ''),
  notes: `VeilBox ${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};
writeFileSync(join(dist, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
