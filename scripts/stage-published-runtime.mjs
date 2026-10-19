#!/usr/bin/env node
// Stage the published @zseven-w/dsh-openpencil-<platform> runtime into
// npm/<platform>/ so the browser smoke (tests/e2e) can boot the real managed
// editor without a local Rust build. Uses the version pinned in this repo's
// own optionalDependencies, so the runtime always matches platforms.json.
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platformById, platformPackageRoot, projectRoot } from './platforms.mjs';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
const platform = platformById(`${process.platform}-${process.arch}`);
const version = pkg.optionalDependencies?.[platform.packageName];
if (version === undefined) throw new Error(`${platform.packageName} is not in optionalDependencies`);

const staging = await mkdtemp(join(tmpdir(), 'dsh-openpencil-stage-'));
try {
  run('npm', ['pack', '--silent', '--pack-destination', staging, `${platform.packageName}@${version}`]);
  const tgz = (await readdir(staging)).find((name) => name.endsWith('.tgz'));
  if (tgz === undefined) throw new Error('npm pack produced no tarball');
  run('tar', ['-xzf', tgz], staging);
  const target = platformPackageRoot(platform);
  await cp(join(staging, 'package', 'bin'), join(target, 'bin'), { recursive: true });
  await cp(join(staging, 'package', 'openpencil-runtime.json'), join(target, 'openpencil-runtime.json'));
  console.log(`staged ${platform.packageName}@${version} -> ${target}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
