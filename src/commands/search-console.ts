import chalk from 'chalk';
import { Command } from 'commander';
import { client } from '../client.js';
import { resolveWorkspace } from '../config.js';
import {
  printTable, printPagination, printDetail, printJson,
  printError, isJsonMode,
} from '../output.js';

function fmtNum(v: unknown): string {
  const n = Number(v) || 0;
  return n.toLocaleString();
}

function fmtPct(v: unknown): string {
  const n = Number(v) || 0;
  return `${n}%`;
}

function fmtPos(v: unknown): string {
  const n = Number(v) || 0;
  if (n <= 3) return chalk.green(n.toString());
  if (n <= 10) return chalk.yellow(n.toString());
  if (n <= 20) return chalk.hex('#f97316')(n.toString());
  return n.toString();
}

function changeStr(current: number, previous: number): string {
  if (previous === 0) return chalk.dim('—');
  const pct = ((current - previous) / previous * 100).toFixed(1);
  const num = Number(pct);
  if (num > 0) return chalk.green(`+${pct}%`);
  if (num < 0) return chalk.red(`${pct}%`);
  return chalk.dim('0%');
}

function posChangeStr(current: number, previous: number): string {
  if (previous === 0) return chalk.dim('—');
  const pct = ((previous - current) / previous * 100).toFixed(1);
  const num = Number(pct);
  if (num > 0) return chalk.green(`+${pct}%`);
  if (num < 0) return chalk.red(`${pct}%`);
  return chalk.dim('0%');
}

interface Metrics { clicks: number; impressions: number; ctr: number; position: number }
interface OverviewResponse {
  search_console: {
    period: { start_date: string; end_date: string };
    previous_period: { start_date: string; end_date: string };
    metrics: Metrics;
    previous_metrics: Metrics;
  };
}

export function registerSearchConsoleCommands(program: Command) {
  const gsc = program.command('search-console').alias('gsc').description('Google Search Console data');

  gsc.command('overview')
    .description('Performance overview with period comparison')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .action(async (opts) => {
      try {
        const ws = resolveWorkspace(opts.workspace);
        const res = await client.get<OverviewResponse>(
          `/workspaces/${ws}/search_console`,
          { start_date: opts.startDate, end_date: opts.endDate }
        );
        const { search_console: sc } = res.data;

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        const m = sc.metrics;
        const p = sc.previous_metrics;

        console.log(chalk.bold(`\nSearch Console Overview`));
        console.log(chalk.dim(`${sc.period.start_date} → ${sc.period.end_date} vs previous period\n`));

        printDetail('Clicks', `${fmtNum(m.clicks)}  ${changeStr(m.clicks, p.clicks)}`);
        printDetail('Impressions', `${fmtNum(m.impressions)}  ${changeStr(m.impressions, p.impressions)}`);
        printDetail('Avg. CTR', `${fmtPct(m.ctr)}  ${changeStr(m.ctr, p.ctr)}`);
        printDetail('Avg. Position', `${fmtPos(m.position)}  ${posChangeStr(m.position, p.position)}`);
        console.log();
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });

  gsc.command('queries')
    .description('Top search queries')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--page <n>', 'Page', '1')
    .option('--per-page <n>', 'Per page', '25')
    .action(async (opts) => {
      try {
        const ws = resolveWorkspace(opts.workspace);
        const res = await client.get<{ queries: Record<string, unknown>[]; meta: { total: number; total_pages: number; page: number; per_page: number } }>(
          `/workspaces/${ws}/search_console/queries`,
          { start_date: opts.startDate, end_date: opts.endDate, page: opts.page, per_page: opts.perPage }
        );
        printTable(res.data.queries, [
          { key: 'query', label: 'Query' },
          { key: 'clicks', label: 'Clicks', format: fmtNum },
          { key: 'impressions', label: 'Impressions', format: fmtNum },
          { key: 'ctr', label: 'CTR', format: fmtPct },
          { key: 'position', label: 'Position', format: fmtPos },
        ]);
        printPagination(res.data.meta);
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });

  gsc.command('pages')
    .description('Top pages by clicks')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--page <n>', 'Page', '1')
    .option('--per-page <n>', 'Per page', '25')
    .action(async (opts) => {
      try {
        const ws = resolveWorkspace(opts.workspace);
        const res = await client.get<{ pages: Record<string, unknown>[]; meta: { total: number; total_pages: number; page: number; per_page: number } }>(
          `/workspaces/${ws}/search_console/pages`,
          { start_date: opts.startDate, end_date: opts.endDate, page: opts.page, per_page: opts.perPage }
        );
        printTable(res.data.pages, [
          { key: 'page', label: 'Page URL' },
          { key: 'clicks', label: 'Clicks', format: fmtNum },
          { key: 'impressions', label: 'Impressions', format: fmtNum },
          { key: 'ctr', label: 'CTR', format: fmtPct },
          { key: 'position', label: 'Position', format: fmtPos },
        ]);
        printPagination(res.data.meta);
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });

  gsc.command('daily')
    .description('Daily performance time series')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .action(async (opts) => {
      try {
        const ws = resolveWorkspace(opts.workspace);
        const res = await client.get<{ daily: Record<string, unknown>[] }>(
          `/workspaces/${ws}/search_console/daily`,
          { start_date: opts.startDate, end_date: opts.endDate }
        );
        printTable(res.data.daily, [
          { key: 'date', label: 'Date' },
          { key: 'clicks', label: 'Clicks', format: fmtNum },
          { key: 'impressions', label: 'Impressions', format: fmtNum },
          { key: 'ctr', label: 'CTR', format: fmtPct },
          { key: 'position', label: 'Position', format: fmtPos },
        ]);
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });
}
