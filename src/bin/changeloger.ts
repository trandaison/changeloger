#!/usr/bin/env node
import mri from 'mri';

async function start() {
  let argv = process.argv.slice(2);
  argv = mri(argv);
  import('../main').then((module) => {
    module.default(argv as any);
  });
}

start();
