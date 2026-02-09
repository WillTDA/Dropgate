import type { ParsedFlags } from '../lib/parse.js';
import {
  readConfig,
  setConfigValue,
  getConfigValue,
  resetConfig,
  getConfigPath,
  getDefaults,
} from '../lib/config-store.js';
import { printHeader, printKeyValue, printSuccess, dim, printBlank } from '../lib/output.js';
import { exitUsage } from '../lib/errors.js';

export async function run(args: string[], _flags: ParsedFlags): Promise<void> {
  const action = args[0];

  switch (action) {
    case 'set': {
      const key = args[1];
      const value = args.slice(2).join(' ');
      if (!key || !value) exitUsage('Usage: dropgate config set <key> <value>');
      setConfigValue(key, value);
      printSuccess(`${key} = ${value}`);
      break;
    }

    case 'get': {
      const key = args[1];
      if (!key) exitUsage('Usage: dropgate config get <key>');
      const val = getConfigValue(key);
      console.log(val !== undefined ? String(val) : dim('(not set)'));
      break;
    }

    case 'list': {
      const config = readConfig();
      const defaults = getDefaults();
      printHeader('Dropgate Configuration');

      for (const [key, val] of Object.entries(config)) {
        const isDefault = val === (defaults as Record<string, unknown>)[key];
        const display = val !== undefined ? String(val) : dim('(not set)');
        printKeyValue(key, isDefault ? dim(display) : display);
      }

      printBlank();
      console.log(`  ${dim(`Config file: ${getConfigPath()}`)}`);
      printBlank();
      break;
    }

    case 'reset': {
      resetConfig();
      printSuccess('Configuration reset to defaults.');
      break;
    }

    case 'path': {
      console.log(getConfigPath());
      break;
    }

    default:
      exitUsage(
        action
          ? `Unknown config action: "${action}". Use: set, get, list, reset, or path.`
          : 'Usage: dropgate config <set|get|list|reset|path>',
      );
  }
}
