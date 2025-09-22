#!/usr/bin/env node
/*
Usage:
  node scripts/typecheck-file.js src/controllers/apiKeyController.ts

This forces TypeScript to use the project's tsconfig for a single-file typecheck by creating a temp tsconfig that extends it.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
  const cwd = process.cwd();
  const projectTsconfig = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(projectTsconfig)) {
    console.error('Could not find tsconfig.json in', cwd);
    process.exit(1);
  }

  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error(
      'Usage: node scripts/typecheck-file.js <relative-path-to-ts-file>'
    );
    process.exit(1);
  }

  const filePath = path.join(cwd, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  // Create a temporary tsconfig that extends the project config
  const tmpConfigPath = path.join(cwd, 'tsconfig.typecheck.tmp.json');
  const tmpConfig = {
    extends: './tsconfig.json',
    include: [],
    files: [fileArg],
  };
  fs.writeFileSync(tmpConfigPath, JSON.stringify(tmpConfig, null, 2));

  // Run tsc using the temporary config
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '--noEmit', '-p', tmpConfigPath],
    { stdio: 'inherit' }
  );

  // Clean up temp file
  try {
    fs.unlinkSync(tmpConfigPath);
  } catch (_) {}

  process.exit(result.status || 0);
}

main();
