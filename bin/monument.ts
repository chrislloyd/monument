import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
  strict: true,
  allowPositionals: true,
});

console.log(values, positionals);
