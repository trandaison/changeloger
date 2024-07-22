#!/usr/bin/env node
import mri from 'mri';

const commands = {
  _default: () => import('../main'),
  version: () => import('../version'),
  help: () => import('../help'),
};

async function start() {
  let argv = process.argv.slice(2);
  let command: keyof typeof commands = argv[0] as any;
  const args = mri(argv, {
    alias: {
      v: ['version'],
      h: ['help'],
    },
  });
  if (args.help || command === 'help') {
    command = 'help';
  } else if (args.version || command === 'version') {
    command = 'version';
  } else {
    command = '_default';
  }
  const subCommand = commands[command] || commands.help;
  await subCommand().then((module) => module.default(args));
}

start();
