// Runs a command with the Rust toolchain on PATH: `node scripts/with-cargo.mjs tauri dev`.
// rustup installs cargo into ~/.cargo/bin, which is often missing from PATH in
// terminals opened before the install (or in IDE terminals) — tauri then fails
// with "cargo metadata ... program not found".
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo');
const cargoBin = join(cargoHome, 'bin');
const env = { ...process.env };
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
if (existsSync(cargoBin) && !(env[pathKey] ?? '').split(delimiter).includes(cargoBin)) {
  env[pathKey] = `${cargoBin}${delimiter}${env[pathKey] ?? ''}`;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: with-cargo.mjs <command> [args...]');
  process.exit(1);
}

// npm puts node_modules/.bin on PATH, so `tauri` resolves to the local CLI.
const child = spawn(command, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
