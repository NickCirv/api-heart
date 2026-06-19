<div align="center">

# api-heart

**Instant API health checks — response time, SSL inspection, letter grade, and uptime history from your terminal.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?labelColor=0B0A09)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/api-heart check <url>
```

## Usage

```bash
# One-off health check
npx github:NickCirv/api-heart check https://api.example.com

# Continuous monitor from a YAML config
npx github:NickCirv/api-heart monitor endpoints.yaml

# History report (last 24 hours)
npx github:NickCirv/api-heart report
```

### `check` flags

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --timeout <ms>` | Request timeout | `10000` |
| `-v, --verbose` | Show all probed endpoints | off |
| `--no-common` | Skip `/health`, `/ping`, `/status` probing | off |

### `monitor` flags

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --interval <seconds>` | Poll interval | `60` |
| `-f, --fail-threshold <n>` | Consecutive failures before alert | `3` |

### `report` flags

| Flag | Description | Default |
|------|-------------|---------|
| `-h, --hours <n>` | Hours of history to show | `24` |
| `--url <url>` | Filter to one URL | all |

## What it does

Runs a full health check against any URL: HTTP status, response time (color-coded A–F grade), redirect chain, response size, and SSL certificate validity with days-until-expiry warning. The `monitor` command polls a YAML list of endpoints on a configurable interval and alerts on consecutive failures. Results are stored in `~/.api-heart/history.json` for the `report` command, which shows uptime percentage, average latency, p95, and a 24-hour sparkline.

Exit code is `0` on success and `1` on failure — works naturally in CI pipelines.

### Monitor config (YAML)

```yaml
endpoints:
  - url: https://api.example.com/health
    name: Production API
    timeout: 5000
  - url: https://staging.example.com/ping
    name: Staging
```

---
<sub>Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
