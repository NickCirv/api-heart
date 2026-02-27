#!/usr/bin/env node

import { program } from 'commander';
import { checkCommand } from '../src/index.js';
import { monitorCommand } from '../src/index.js';
import { reportCommand } from '../src/index.js';

program
  .name('api-heart')
  .description('API health dashboard with AI diagnostics')
  .version('1.0.0');

program
  .command('check <url>')
  .description('Run a health check on a single URL')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('-v, --verbose', 'Show detailed output')
  .option('--no-common', 'Skip common endpoint probing')
  .action(async (url, opts) => {
    await checkCommand(url, opts);
  });

program
  .command('monitor <config>')
  .description('Monitor endpoints defined in a YAML/JSON config file')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '60')
  .option('-f, --fail-threshold <n>', 'Consecutive failures before alert', '3')
  .action(async (config, opts) => {
    await monitorCommand(config, opts);
  });

program
  .command('report')
  .description('Show health report from stored history')
  .option('-h, --hours <n>', 'Hours of history to include', '24')
  .option('--url <url>', 'Filter report to a specific URL')
  .action(async (opts) => {
    await reportCommand(opts);
  });

program.parse();
