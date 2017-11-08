#!/usr/bin/env node
const bot = require('../src/index')()

require('yargs') // eslint-disable-line no-unused-expressions
  .usage('$0 <command>')
  .command(require('../src/commands/selfsign')(bot))
  .command(require('../src/commands/getlegit')(bot))
  .help()
  .version()
  .argv
