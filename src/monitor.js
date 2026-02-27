import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'js-yaml';
import { checkEndpoint, gradeEndpoint } from './checker.js';
import { formatStatus, formatResponseTime } from './formatter.js';
import chalk from 'chalk';

const HISTORY_DIR = join(homedir(), '.api-heart');
const HISTORY_FILE = join(HISTORY_DIR, 'history.json');

export function ensureHistoryDir() {
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
  }
  if (!existsSync(HISTORY_FILE)) {
    writeFileSync(HISTORY_FILE, '', 'utf8');
  }
}

export function appendHistory(record) {
  ensureHistoryDir();
  appendFileSync(HISTORY_FILE, JSON.stringify(record) + '\n', 'utf8');
}

export function readHistory(hours = 24, filterUrl = null) {
  ensureHistoryDir();
  if (!existsSync(HISTORY_FILE)) return [];

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const lines = readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  const records = [];

  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      if (new Date(rec.timestamp).getTime() >= cutoff) {
        if (!filterUrl || rec.url === filterUrl) {
          records.push(rec);
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return records;
}

export function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, 'utf8');
  const ext = configPath.split('.').pop().toLowerCase();

  if (ext === 'yaml' || ext === 'yml') {
    return parseYaml(raw);
  }

  return JSON.parse(raw);
}

export async function runMonitorCycle(endpoints, failThreshold, failCounts) {
  const results = [];

  for (const endpoint of endpoints) {
    const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
    const name = typeof endpoint === 'object' ? (endpoint.name || url) : url;
    const timeout = typeof endpoint === 'object' ? (endpoint.timeout || 10000) : 10000;

    const result = await checkEndpoint(url, { timeout });
    const grade = gradeEndpoint(result);

    const record = { ...result, name, grade };
    appendHistory(record);
    results.push(record);

    const key = url;
    if (!result.ok || result.error) {
      failCounts[key] = (failCounts[key] || 0) + 1;
      if (failCounts[key] >= failThreshold) {
        printAlert(name, url, result, failCounts[key]);
      }
    } else {
      if (failCounts[key] >= failThreshold) {
        printRecovery(name, url, result);
      }
      failCounts[key] = 0;
    }

    printMonitorLine(name, result, grade);
  }

  return results;
}

function printAlert(name, url, result, consecutiveFails) {
  const msg = result.error || `HTTP ${result.status}`;
  process.stderr.write(
    chalk.bgRed.white.bold(` ALERT `) +
    chalk.red(` ${name} is DOWN — ${msg} (${consecutiveFails} consecutive failures)\n`) +
    chalk.gray(`  → ${url}\n`)
  );
}

function printRecovery(name, url, result) {
  process.stdout.write(
    chalk.bgGreen.black.bold(` RECOVERED `) +
    chalk.green(` ${name} is back up — HTTP ${result.status} (${result.responseTime}ms)\n`) +
    chalk.gray(`  → ${url}\n`)
  );
}

function printMonitorLine(name, result, grade) {
  const statusBadge = formatStatus(result);
  const timeBadge = result.responseTime ? formatResponseTime(result.responseTime) : chalk.gray('—');
  const ts = chalk.gray(new Date().toLocaleTimeString());
  process.stdout.write(`${ts}  ${statusBadge}  ${timeBadge}  ${chalk.white(name)}\n`);
}
