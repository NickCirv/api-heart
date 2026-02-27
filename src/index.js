import chalk from 'chalk';
import { checkEndpoint, probeCommonEndpoints, gradeEndpoint } from './checker.js';
import { loadConfig, runMonitorCycle, appendHistory, ensureHistoryDir } from './monitor.js';
import { generateReport } from './reporter.js';
import {
  formatStatus,
  formatResponseTime,
  formatGrade,
  formatSSL,
  formatSize,
  divider,
  header,
} from './formatter.js';

export async function checkCommand(url, opts) {
  const timeout = parseInt(opts.timeout, 10);
  const verbose = opts.verbose || false;
  const probeCommon = opts.common !== false;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log('');
  console.log(header(`Checking ${url}`));
  console.log(chalk.gray(`  timeout: ${timeout}ms${probeCommon ? '  · probing common endpoints' : ''}`));
  console.log('');

  const spinner = startSpinner('Running health check...');
  const result = await checkEndpoint(url, { timeout });
  stopSpinner(spinner);

  const grade = gradeEndpoint(result);
  const record = { ...result, grade };
  ensureHistoryDir();
  appendHistory(record);

  // Main result
  console.log(divider());
  console.log(`  ${formatGrade(grade)}  ${formatStatus(result)}  ${formatResponseTime(result.responseTime)}`);
  console.log('');

  if (result.error) {
    console.log(chalk.red(`  Error: ${result.error}`));
  } else {
    console.log(`  Status       ${result.status} ${result.statusText}`);
    console.log(`  Response     ${formatResponseTime(result.responseTime)}`);
    console.log(`  Size         ${formatSize(result.responseSize)}`);
    if (result.redirectChain.length > 1) {
      console.log(`  Redirects    ${result.redirectChain.join(' → ')}`);
    }
  }

  if (result.ssl) {
    console.log('');
    console.log(chalk.bold('  SSL Certificate'));
    console.log(`  Valid        ${result.ssl.valid ? chalk.green('Yes') : chalk.red('No')}`);
    if (result.ssl.subject) console.log(`  Subject      ${result.ssl.subject}`);
    if (result.ssl.issuer) console.log(`  Issuer       ${result.ssl.issuer}`);
    console.log(`  Expires      ${formatSSL(result.ssl)}`);
    if (result.ssl.expiresAt) console.log(chalk.gray(`               ${result.ssl.expiresAt}`));
  }

  if (verbose && probeCommon && !result.error) {
    console.log('');
    console.log(chalk.bold('  Common Endpoints'));
    const spinner2 = startSpinner('Probing...');
    const probes = await probeCommonEndpoints(url);
    stopSpinner(spinner2);

    for (const probe of probes) {
      const badge = probe.found
        ? chalk.green('FOUND')
        : probe.status
          ? chalk.yellow(`${probe.status}`)
          : chalk.gray('—');
      const ms = probe.ms ? chalk.gray(`${probe.ms}ms`) : '';
      console.log(`  ${probe.path.padEnd(15)} ${badge}  ${ms}`);
    }
  } else if (probeCommon && !result.error) {
    const spinner2 = startSpinner('Probing common endpoints...');
    const probes = await probeCommonEndpoints(url);
    stopSpinner(spinner2);
    const found = probes.filter((p) => p.found);
    if (found.length > 0) {
      console.log('');
      console.log(chalk.bold('  Common Endpoints Found'));
      for (const probe of found) {
        console.log(`  ${chalk.green('✓')} ${probe.path}  ${chalk.gray(`${probe.ms}ms`)}`);
      }
    }
  }

  console.log('');
  console.log(divider());

  const gradeLabel = {
    A: chalk.green('Excellent'),
    B: chalk.cyan('Good'),
    C: chalk.yellow('Fair'),
    D: chalk.magenta('Poor'),
    F: chalk.red('Critical'),
  };
  console.log(`  Health Grade  ${formatGrade(grade)}  ${gradeLabel[grade] || ''}`);
  console.log('');

  process.exitCode = result.ok ? 0 : 1;
}

export async function monitorCommand(configPath, opts) {
  const interval = parseInt(opts.interval, 10) * 1000;
  const failThreshold = parseInt(opts.failThreshold, 10);

  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    console.error(chalk.red(`Config error: ${err.message}`));
    process.exit(1);
  }

  const endpoints = config.endpoints || (Array.isArray(config) ? config : [config]);

  if (!endpoints || endpoints.length === 0) {
    console.error(chalk.red('No endpoints found in config. Expected: { endpoints: [...] }'));
    process.exit(1);
  }

  console.log('');
  console.log(header('api-heart monitor'));
  console.log(chalk.gray(`  ${endpoints.length} endpoint(s) · interval: ${opts.interval}s · fail threshold: ${failThreshold}`));
  console.log(chalk.gray('  Press Ctrl+C to stop'));
  console.log('');

  const failCounts = {};

  const runCycle = async () => {
    console.log(chalk.hex('#EF4444')(`── cycle ${new Date().toLocaleTimeString()} ──`));
    await runMonitorCycle(endpoints, failThreshold, failCounts);
  };

  await runCycle();
  const handle = setInterval(runCycle, interval);

  process.on('SIGINT', () => {
    clearInterval(handle);
    console.log('\n' + chalk.gray('Monitor stopped.'));
    process.exit(0);
  });
}

export async function reportCommand(opts) {
  const hours = parseInt(opts.hours, 10);
  const filterUrl = opts.url || null;
  generateReport(hours, filterUrl);
}

function startSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write('  ');
  const id = setInterval(() => {
    process.stdout.write(`\r  ${chalk.hex('#EF4444')(frames[i % frames.length])} ${chalk.gray(text)}`);
    i++;
  }, 80);
  return id;
}

function stopSpinner(id) {
  clearInterval(id);
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
}
