import { spawn } from 'node:child_process';
import path from 'node:path';

// Launch Bun with watch mode using the monorepo root as working directory
// so that apps/api/src, packages/db/src, and packages/shared/src all reside
// within Bun's process.cwd() file-watching boundary.
const rootDir = path.resolve(import.meta.dir, '../../..');

const child = spawn('bun', ['--watch', 'apps/api/src/index.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

