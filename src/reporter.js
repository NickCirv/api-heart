import chalk from 'chalk';
import { readHistory } from './monitor.js';
import {
  formatStatus,
  formatResponseTime,
  formatGrade,
  formatSSL,
  formatSize,
  uptimeSparkline,
  responseTimeBar,
  divider,
  header,
} from './formatter.js';

export function generateReport(hours = 24, filterUrl = null) {
  const records = readHistory(hours, filterUrl);

  if (records.length === 0) {
    console.log(chalk.yellow('No history found. Run `api-heart check <url>` or `api-heart monitor <config>` first.'));
    return;
  }

  // Group by URL
  const byUrl = {};
  for (const rec of records) {
    const key = rec.url;
    if (!byUrl[key]) byUrl[key] = [];
    byUrl[key].push(rec);
  }

  printReportHeader(hours);

  for (const [url, checks] of Object.entries(byUrl)) {
    printEndpointSection(url, checks);
  }

  printOverallSummary(records);
}

function printReportHeader(hours) {
  console.log('');
  console.log(chalk.hex('#EF4444').bold('  ♥  api-heart') + chalk.gray('  health report'));
  console.log(chalk.gray(`  Last ${hours} hours · ${new Date().toLocaleString()}`));
  console.log('');
}

function printEndpointSection(url, checks) {
  const name = checks[0]?.name || url;
  const total = checks.length;
  const downs = checks.filter((c) => !c.ok || c.error).length;
  const ups = total - downs;
  const uptimePct = total > 0 ? ((ups / total) * 100).toFixed(1) : '0.0';

  const responseTimes = checks.filter((c) => c.responseTime !== null).map((c) => c.responseTime);
  const avgMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;
  const p95Ms = responseTimes.length > 0
    ? percentile(responseTimes, 95)
    : null;

  const latest = checks[checks.length - 1];
  const grade = gradeFromStats(uptimePct, avgMs, latest);

  console.log(divider());
  console.log(`  ${formatGrade(grade)}  ${chalk.white.bold(name)}`);
  console.log(chalk.gray(`  ${url}`));
  console.log('');

  // Uptime
  const uptimeColor = uptimePct >= 99.9 ? chalk.green : uptimePct >= 95 ? chalk.yellow : chalk.red;
  console.log(`  Uptime      ${uptimeColor(`${uptimePct}%`)}  (${ups}/${total} checks passed)`);

  // Response time
  if (avgMs !== null) {
    console.log(`  Avg latency ${formatResponseTime(avgMs)}  p95: ${formatResponseTime(p95Ms)}`);
    console.log(`  Latency bar ${responseTimeBar(avgMs)}`);
  }

  // Status history sparkline
  console.log(`  24h history ${uptimeSparkline(checks)}`);

  // SSL
  if (latest?.ssl) {
    console.log(`  SSL cert    ${formatSSL(latest.ssl)}`);
  }

  // Last check
  if (latest) {
    const lastBadge = formatStatus(latest);
    const lastSize = formatSize(latest.responseSize);
    console.log(`  Last check  ${lastBadge}  ${formatResponseTime(latest.responseTime)}  ${chalk.gray(lastSize)}`);
    if (latest.redirectChain && latest.redirectChain.length > 1) {
      console.log(chalk.gray(`  Redirected  ${latest.redirectChain.join(' → ')}`));
    }
    if (latest.error) {
      console.log(chalk.red(`  Error       ${latest.error}`));
    }
  }

  console.log('');
}

function printOverallSummary(records) {
  const total = records.length;
  const downs = records.filter((r) => !r.ok || r.error).length;
  const ups = total - downs;
  const overallUptime = total > 0 ? ((ups / total) * 100).toFixed(1) : '0.0';
  const allTimes = records.filter((r) => r.responseTime).map((r) => r.responseTime);
  const overallAvg = allTimes.length > 0
    ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
    : null;

  console.log(divider());
  console.log(header('Overall Summary'));
  console.log('');
  const pctStr = `${overallUptime}%`;
  const pctColored = parseFloat(overallUptime) >= 99.9
    ? chalk.green(pctStr)
    : parseFloat(overallUptime) >= 95 ? chalk.yellow(pctStr) : chalk.red(pctStr);

  console.log(`  Endpoints       ${chalk.white(Object.keys(groupByUrl(records)).length)}`);
  console.log(`  Total checks    ${chalk.white(total)}`);
  console.log(`  Overall uptime  ${pctColored}`);
  if (overallAvg !== null) {
    console.log(`  Overall avg ms  ${formatResponseTime(overallAvg)}`);
  }
  console.log('');
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function groupByUrl(records) {
  const out = {};
  for (const r of records) {
    if (!out[r.url]) out[r.url] = [];
    out[r.url].push(r);
  }
  return out;
}

function gradeFromStats(uptimePct, avgMs, latest) {
  if (latest?.error || (latest && !latest.ok && latest.status >= 500)) return 'F';
  const uptime = parseFloat(uptimePct);
  if (uptime < 90) return 'F';
  if (uptime < 95) return 'D';
  if (avgMs === null) return 'C';
  if (avgMs < 200 && uptime >= 99.9) return 'A';
  if (avgMs < 500 && uptime >= 99) return 'B';
  if (avgMs < 1500 && uptime >= 95) return 'C';
  return 'D';
}
