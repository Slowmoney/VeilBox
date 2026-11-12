// Sets the app version everywhere from a git tag: `node scripts/set-version.mjs v2.3.0`.
// package.json, tauri.conf.json, Cargo.toml and the app's entry in Cargo.lock
// (CI runs `cargo test --locked`, so the lock file must agree).
import { readFileSync, writeFileSync } from 'node:fs';

const raw = process.argv[2] ?? '';
const version = raw.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Not a semver tag: "${raw}"`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = version;
writeFileSync('src-tauri/tauri.conf.json', `${JSON.stringify(conf, null, 2)}\n`);

const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
const nameMatch = /\[package\][^[]*?name\s*=\s*"([^"]+)"/.exec(cargo);
writeFileSync(
  'src-tauri/Cargo.toml',
  cargo.replace(/(\[package\][^[]*?version\s*=\s*")[^"]+(")/, `$1${version}$2`),
);

if (nameMatch) {
  const lock = readFileSync('src-tauri/Cargo.lock', 'utf8');
  const crate = nameMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  writeFileSync(
    'src-tauri/Cargo.lock',
    lock.replace(new RegExp(`(name = "${crate}"\\nversion = ")[^"]+(")`), `$1${version}$2`),
  );
}

console.log(`version ${version}`);
