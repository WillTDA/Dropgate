import { parseArgs, hasFlag } from './lib/parse.js';
import type { ParsedFlags } from './lib/parse.js';
import { displayError, EXIT_SUCCESS, EXIT_USAGE } from './lib/errors.js';
import { printError, printHint, printBlank, bold, dim, cyan, showCursor } from './lib/output.js';

import * as uploadCmd from './commands/upload.js';
import * as downloadCmd from './commands/download.js';
import * as sendCmd from './commands/send.js';
import * as receiveCmd from './commands/receive.js';
import * as infoCmd from './commands/info.js';
import * as configCmd from './commands/config.js';

const commandMap: Record<string, { run: (args: string[], flags: ParsedFlags) => Promise<void> }> = {
  upload: uploadCmd,
  download: downloadCmd,
  send: sendCmd,
  receive: receiveCmd,
  info: infoCmd,
  config: configCmd,
};

const CLI_VERSION = process.env.DROPGATE_CLI_VERSION || '3.0.5';

function printVersion(): void {
  console.log(`dropgate-cli v${CLI_VERSION}`);
}

function printHelp(): void {
  console.log();
  console.log(`  ${bold('Dropgate CLI')} ${dim(`v${CLI_VERSION}`)}`);
  console.log(`  ${dim('A command-line interface for Dropgate file sharing.')}`);
  console.log();
  console.log(`  ${bold('Usage:')}`);
  console.log(`    dropgate ${cyan('<command>')} [options]`);
  console.log();
  console.log(`  ${bold('Commands:')}`);
  console.log(`    ${cyan('upload')}     Upload files to a Dropgate server`);
  console.log(`    ${cyan('download')}   Download files (via URL, file ID, or share code)`);
  console.log(`    ${cyan('send')}       Send files directly via P2P`);
  console.log(`    ${cyan('receive')}    Receive files directly via P2P`);
  console.log(`    ${cyan('info')}       Show server information and capabilities`);
  console.log(`    ${cyan('config')}     Manage CLI configuration`);
  console.log();
  console.log(`  ${bold('Global Options:')}`);
  console.log(`    --server <url>   Override the configured server URL`);
  console.log(`    --no-color       Disable colored output`);
  console.log(`    --quiet          Suppress non-essential output`);
  console.log(`    --json           Output results as JSON`);
  console.log(`    --version        Show CLI version`);
  console.log(`    --help           Show this help text`);
  console.log();
  console.log(`  ${bold('Examples:')}`);
  console.log(`    ${dim('# Configure your server')}`);
  console.log(`    dropgate config set server https://myserver.com`);
  console.log();
  console.log(`    ${dim('# Upload a single file')}`);
  console.log(`    dropgate upload -i photo.jpg`);
  console.log();
  console.log(`    ${dim('# Upload multiple files as a bundle')}`);
  console.log(`    dropgate upload -i file1.txt -i file2.txt --lifetime 7d`);
  console.log();
  console.log(`    ${dim('# Download from a URL')}`);
  console.log(`    dropgate download https://myserver.com/abc123#keyBase64`);
  console.log();
  console.log(`    ${dim('# Send a file via P2P')}`);
  console.log(`    dropgate send -i presentation.pptx`);
  console.log();
  console.log(`    ${dim('# Receive a file via P2P')}`);
  console.log(`    dropgate receive ABCD-1234`);
  console.log();
}

function printCommandHelp(command: string): void {
  switch (command) {
    case 'upload':
      console.log();
      console.log(`  ${bold('dropgate upload')} - Upload files to a Dropgate server`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate upload -i <file> [-i <file> ...] [options]`);
      console.log();
      console.log(`  ${bold('Required:')}`);
      console.log(`    -i, --input <file>        File to upload (repeat for bundles)`);
      console.log();
      console.log(`  ${bold('Options:')}`);
      console.log(`    --lifetime <duration>     File lifetime (e.g. 24h, 7d, 30m, 0) ${dim('default: 24h')}`);
      console.log(`    --max-downloads <n>       Max downloads, 0=unlimited ${dim('default: 1')}`);
      console.log(`    --encrypt                 Force enable E2EE`);
      console.log(`    --no-encrypt              Force disable E2EE`);
      console.log(`    --server <url>            Override configured server URL`);
      console.log(`    --quiet                   Only print the download URL`);
      console.log(`    --json                    Output result as JSON`);
      console.log();
      console.log(`  ${bold('Examples:')}`);
      console.log(`    dropgate upload -i photo.jpg`);
      console.log(`    dropgate upload -i f1.txt -i f2.txt --lifetime 7d --max-downloads 5`);
      console.log(`    dropgate upload -i secret.pdf --encrypt --lifetime 1h`);
      console.log(`    dropgate upload -i data.zip --quiet`);
      console.log();
      break;

    case 'download':
      console.log();
      console.log(`  ${bold('dropgate download')} - Download files from a Dropgate server`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate download <target> [options]`);
      console.log();
      console.log(`  ${bold('Target can be:')}`);
      console.log(`    A full download URL        https://server.com/abc123#keyBase64`);
      console.log(`    A bundle URL               https://server.com/b/bundleId#keyBase64`);
      console.log(`    A file ID                  abc123`);
      console.log(`    A P2P share code           ABCD-1234`);
      console.log();
      console.log(`  ${bold('Options:')}`);
      console.log(`    -o, --output <path>       Output directory ${dim('default: current dir')}`);
      console.log(`    --key <base64>            Decryption key (for raw file IDs)`);
      console.log(`    --server <url>            Override configured server URL`);
      console.log(`    --quiet                   Only print saved file path`);
      console.log(`    --json                    Output result as JSON`);
      console.log();
      break;

    case 'send':
      console.log();
      console.log(`  ${bold('dropgate send')} - Send files directly via P2P`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate send -i <file> [-i <file> ...]`);
      console.log();
      console.log(`  ${bold('Required:')}`);
      console.log(`    -i, --input <file>        File(s) to send`);
      console.log();
      console.log(`  ${bold('Options:')}`);
      console.log(`    --server <url>            Override configured server URL`);
      console.log(`    --quiet                   Show only the share code`);
      console.log();
      break;

    case 'receive':
      console.log();
      console.log(`  ${bold('dropgate receive')} - Receive files directly via P2P`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate receive <code> [options]`);
      console.log();
      console.log(`  ${bold('Arguments:')}`);
      console.log(`    code                      Share code (e.g. ABCD-1234)`);
      console.log();
      console.log(`  ${bold('Options:')}`);
      console.log(`    -o, --output <path>       Output directory ${dim('default: current dir')}`);
      console.log(`    -y, --yes                 Auto-accept without confirmation`);
      console.log(`    --server <url>            Override configured server URL`);
      console.log(`    --quiet                   Suppress progress output`);
      console.log(`    --json                    Output result as JSON`);
      console.log();
      break;

    case 'info':
      console.log();
      console.log(`  ${bold('dropgate info')} - Show server information`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate info [--server <url>]`);
      console.log();
      console.log(`  ${bold('Options:')}`);
      console.log(`    --server <url>            Server URL (overrides config)`);
      console.log(`    --json                    Output as JSON`);
      console.log();
      break;

    case 'config':
      console.log();
      console.log(`  ${bold('dropgate config')} - Manage CLI configuration`);
      console.log();
      console.log(`  ${bold('Usage:')}`);
      console.log(`    dropgate config <action> [key] [value]`);
      console.log();
      console.log(`  ${bold('Actions:')}`);
      console.log(`    set <key> <value>         Set a configuration value`);
      console.log(`    get <key>                 Get a configuration value`);
      console.log(`    list                      Show all configuration`);
      console.log(`    reset                     Reset to defaults`);
      console.log(`    path                      Show config file location`);
      console.log();
      console.log(`  ${bold('Keys:')}`);
      console.log(`    server                    Default server URL`);
      console.log(`    lifetime                  Default file lifetime (e.g. 24h, 7d)`);
      console.log(`    max-downloads             Default max downloads (e.g. 1, 0)`);
      console.log(`    encrypt                   Default encryption (auto, on, off)`);
      console.log();
      break;

    default:
      printHelp();
  }
}

const COMMANDS = ['upload', 'download', 'send', 'receive', 'info', 'config'] as const;
type Command = typeof COMMANDS[number];

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv);

  // Global flags
  if (hasFlag(flags, 'version')) {
    printVersion();
    process.exit(EXIT_SUCCESS);
  }

  if (hasFlag(flags, 'help') && !command) {
    printHelp();
    process.exit(EXIT_SUCCESS);
  }

  if (!command) {
    printHelp();
    process.exit(EXIT_SUCCESS);
  }

  // Command-level help
  if (hasFlag(flags, 'help')) {
    printCommandHelp(command);
    process.exit(EXIT_SUCCESS);
  }

  if (!COMMANDS.includes(command as Command)) {
    printError(`Unknown command: "${command}"`);
    printHint('Run "dropgate --help" to see available commands.');
    printBlank();
    process.exit(EXIT_USAGE);
  }

  // Dispatch to command handler
  try {
    const mod = commandMap[command];
    await mod.run(args, flags);
  } catch (err) {
    showCursor(); // Ensure cursor is visible on error
    const exitCode = displayError(err);
    printBlank();
    process.exit(exitCode);
  }
}

// Ensure cursor is restored on exit
process.on('exit', () => showCursor());
process.on('uncaughtException', (err) => {
  showCursor();
  displayError(err);
  printBlank();
  process.exit(1);
});

main().catch((err) => {
  showCursor();
  displayError(err);
  printBlank();
  process.exit(1);
});
