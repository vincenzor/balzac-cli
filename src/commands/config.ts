import { Command } from 'commander';
import chalk from 'chalk';
import {
  setApiKey, setDefaultWorkspace, setApiUrl,
  getApiKey, getDefaultWorkspace, getApiUrl, getConfigPath,
  resetConfig,
} from '../config.js';
import { printSuccess, printError, printInfo, isJsonMode, printJson } from '../output.js';

function warnEnvOverrides() {
  const overrides: string[] = [];
  if (process.env.BALZAC_API_URL) overrides.push(`BALZAC_API_URL=${process.env.BALZAC_API_URL}`);
  if (process.env.BALZAC_API_KEY) overrides.push(`BALZAC_API_KEY=(set)`);
  if (overrides.length > 0) {
    printInfo(
      'Environment variable override active: ' + overrides.join(', ') +
      '\n  Environment variables take precedence over config file values.' +
      '\n  Run ' + chalk.bold('unset ' + overrides.map(o => o.split('=')[0]).join(' ')) + ' to use config file values.'
    );
  }
}

export function registerConfigCommands(program: Command) {
  const cfg = program.command('config').description('Manage CLI configuration');

  cfg.command('set')
    .description('Set a config value')
    .argument('<key>', 'Config key: workspace, api-key, api-url')
    .argument('<value>', 'Value to set')
    .action((key, value) => {
      try {
        switch (key) {
          case 'workspace':
            setDefaultWorkspace(value);
            printSuccess(`Default workspace set to ${value}`);
            break;
          case 'api-key':
            setApiKey(value);
            printSuccess('API key saved.');
            if (process.env.BALZAC_API_KEY) {
              printInfo('Warning: BALZAC_API_KEY environment variable is set and will take precedence over the saved value.');
            }
            break;
          case 'api-url':
            setApiUrl(value);
            printSuccess(`API URL set to ${value}`);
            if (process.env.BALZAC_API_URL) {
              printInfo(
                'Warning: BALZAC_API_URL environment variable is set to ' + process.env.BALZAC_API_URL +
                '\n  The environment variable takes precedence. Run ' + chalk.bold('unset BALZAC_API_URL') + ' to use the saved value.'
              );
            }
            break;
          default:
            printError(new Error(`Unknown config key: ${key}. Valid keys: workspace, api-key, api-url`));
            process.exit(1);
        }
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });

  cfg.command('get')
    .description('Get a config value')
    .argument('[key]', 'Config key (omit to show all)')
    .action((key) => {
      try {
        if (!key) {
          const all = {
            workspace: getDefaultWorkspace() || '(not set)',
            api_key: getApiKey() ? getApiKey().slice(0, 6) + '…' + getApiKey().slice(-4) : '(not set)',
            api_url: getApiUrl(),
            config_path: getConfigPath(),
          };
          if (isJsonMode()) {
            const envOverrides: Record<string, string> = {};
            if (process.env.BALZAC_API_URL) envOverrides.api_url_env = process.env.BALZAC_API_URL;
            if (process.env.BALZAC_API_KEY) envOverrides.api_key_env = '(set via env)';
            printJson({ ...all, ...envOverrides });
          } else {
            for (const [k, v] of Object.entries(all)) {
              console.log(chalk.bold(k + ':') + ' ' + v);
            }
            warnEnvOverrides();
          }
          return;
        }

        const map: Record<string, () => string> = {
          workspace: getDefaultWorkspace,
          'api-key': () => {
            const k = getApiKey();
            return k ? k.slice(0, 6) + '…' + k.slice(-4) : '';
          },
          'api-url': getApiUrl,
          path: getConfigPath,
        };
        const fn = map[key];
        if (!fn) {
          printError(new Error(`Unknown config key: ${key}`));
          process.exit(1);
        }
        const val = fn();
        if (isJsonMode()) {
          printJson({ [key]: val });
        } else {
          console.log(val || chalk.dim('(not set)'));
        }
      } catch (err) {
        printError(err);
        process.exit(1);
      }
    });

  cfg.command('reset')
    .description('Reset all configuration')
    .action(() => {
      resetConfig();
      printSuccess('Configuration reset.');
    });
}
