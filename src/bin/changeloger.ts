#!/usr/bin/env node
import mri from 'mri';

const commands = {
  _default: () => import('../main'),
  version: () => import('../version'),
};

async function start() {
  let argv = process.argv.slice(2);
  let command: keyof typeof commands = argv[0] as any;
  if (!command) {
    command = '_default';
  }
  const args = mri(argv, {
    alias: {
      v: ['version'],
    },
  });
  if (args.version) {
    command = 'version';
  }
  await commands[command]().then((module) => module.default(args));
}

start();
