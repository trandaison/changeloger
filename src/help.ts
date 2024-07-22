export default function help(_args: any) {
  console.log('Usage: changeloger <command> [options]');
  console.log('\n');
  console.log('Commands:');
  console.log('  <empty> Generate changelog');
  console.log('  help    Show this help message');
  console.log('  version Show version');
  console.log('\n');
  console.log(
    '\x1b[33m\x1b[1mFull documentation is not implemented yet. Please visit \x1b[34mhttps://github.com/trandaison/changeloger?tab=readme-ov-file#cli-usage\x1b[33m for more information.\x1b[0m'
  );
}
