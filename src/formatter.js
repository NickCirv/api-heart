import chalk from 'chalk';

const GRADE_COLORS = {
  A: chalk.bgGreen.black,
  B: chalk.bgCyan.black,
  C: chalk.bgYellow.black,
  D: chalk.bgMagenta.white,
  F: chalk.bgRed.white,
};

const STATUS_OK_RANGE = (s) => s >= 200 && s < 300;
const STATUS_REDIRECT = (s) => s >= 300 && s < 400;
const STATUS_CLIENT_ERR = (s) => s >= 400 && s < 500;
const STATUS_SERVER_ERR = (s) => s >= 500;

export function formatStatus(result) {
  if (result.error) return chalk.bgRed.white.bold(' DOWN ');
  if (!result.status) return chalk.bgGray.white(' UNKN ');
  const s = result.status;
  if (STATUS_OK_RANGE(s)) return chalk.bgGreen.black.bold(` ${s} `);
  if (STATUS_REDIRECT(s)) return chalk.bgCyan.black.bold(` ${s} `);
  if (STATUS_CLIENT_ERR(s)) return chalk.bgYellow.black.bold(` ${s} `);
  if (STATUS_SERVER_ERR(s)) return chalk.bgRed.white.bold(` ${s} `);
  return chalk.bgGray.white(` ${s} `);
}

export function formatResponseTime(ms) {
  if (ms === null || ms === undefined) return chalk.gray('  —  ');
  if (ms < 200) return chalk.green(`${ms}ms`);
  if (ms < 500) return chalk.yellow(`${ms}ms`);
  if (ms < 1500) return chalk.hex('#FFA500')(`${ms}ms`);
  return chalk.red(`${ms}ms`);
}

export function formatGrade(grade) {
  const colorFn = GRADE_COLORS[grade] || chalk.bgGray.white;
  return colorFn.bold(` ${grade} `);
}

export function formatSSL(ssl) {
  if (!ssl) return chalk.gray('No SSL');
  if (ssl.error) return chalk.red(`SSL Error: ${ssl.error}`);
  const days = ssl.daysRemaining;
  if (days === null) return chalk.gray('SSL Unknown');
  if (days < 7) return chalk.bgRed.white.bold(` ${days}d `);
  if (days < 30) return chalk.yellow(`${days} days`);
  return chalk.green(`${days} days`);
}

export function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function uptimeSparkline(checks) {
  // 24 blocks representing last 24 hours
  const BLOCK_OK = chalk.green('█');
  const BLOCK_SLOW = chalk.yellow('█');
  const BLOCK_DOWN = chalk.red('█');
  const BLOCK_EMPTY = chalk.gray('░');

  if (!checks || checks.length === 0) {
    return chalk.gray('░'.repeat(24));
  }

  // Group into 24 hourly buckets
  const now = Date.now();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const bucketEnd = now - i * 60 * 60 * 1000;
    const bucketStart = bucketEnd - 60 * 60 * 1000;
    return checks.filter((c) => {
      const t = new Date(c.timestamp).getTime();
      return t >= bucketStart && t < bucketEnd;
    });
  }).reverse();

  return buckets
    .map((bucket) => {
      if (bucket.length === 0) return BLOCK_EMPTY;
      const downs = bucket.filter((c) => !c.ok || c.error).length;
      const ratio = downs / bucket.length;
      if (ratio === 0) {
        const avgMs = bucket.reduce((a, b) => a + (b.responseTime || 0), 0) / bucket.length;
        return avgMs > 1500 ? BLOCK_SLOW : BLOCK_OK;
      }
      if (ratio < 0.5) return BLOCK_SLOW;
      return BLOCK_DOWN;
    })
    .join('');
}

export function responseTimeBar(ms, maxMs = 3000) {
  const BAR_WIDTH = 20;
  if (ms === null || ms === undefined) return chalk.gray('—'.padEnd(BAR_WIDTH));
  const filled = Math.min(Math.round((ms / maxMs) * BAR_WIDTH), BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (ms < 200) return chalk.green(bar);
  if (ms < 500) return chalk.yellow(bar);
  if (ms < 1500) return chalk.hex('#FFA500')(bar);
  return chalk.red(bar);
}

export function divider(width = 60) {
  return chalk.gray('─'.repeat(width));
}

export function header(title) {
  const line = chalk.hex('#EF4444')('▶ ') + chalk.white.bold(title);
  return line;
}
