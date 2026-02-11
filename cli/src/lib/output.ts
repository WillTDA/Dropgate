const noColor = process.argv.includes('--no-color') || !process.stdout.isTTY || process.env.NO_COLOR !== undefined;

const esc = (code: string) => (text: string) => noColor ? text : `\x1b[${code}m${text}\x1b[0m`;

export const bold = esc('1');
export const dim = esc('2');
export const italic = esc('3');
export const red = esc('31');
export const green = esc('32');
export const yellow = esc('33');
export const cyan = esc('36');
export const white = esc('37');
export const boldCyan = (text: string) => bold(cyan(text));
export const boldGreen = (text: string) => bold(green(text));
export const boldRed = (text: string) => bold(red(text));

export function printHeader(title: string): void {
  console.log();
  console.log(` ${bold(title)}`);
  console.log();
}

export function printKeyValue(key: string, value: string, indent = 2): void {
  const pad = ' '.repeat(indent);
  const keyPadded = key.padEnd(16);
  console.log(`${pad}${dim(keyPadded)}${value}`);
}

export function printSuccess(message: string): void {
  console.log(`  ${green('\u2714')} ${message}`);
}

export function printError(message: string): void {
  console.error();
  console.error(`  ${red('\u2718')} ${bold('Error:')} ${message}`);
}

export function printWarning(message: string): void {
  console.log(`  ${yellow('\u26A0')} ${message}`);
}

export function printHint(message: string): void {
  console.error(`  ${dim(message)}`);
}

export function printBlank(): void {
  console.log();
}

export function clearLine(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2K\r');
  }
}

export function cursorUp(lines: number): void {
  if (process.stdout.isTTY && lines > 0) {
    process.stdout.write(`\x1b[${lines}A`);
  }
}

export function hideCursor(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25l');
  }
}

export function showCursor(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25h');
  }
}

export function isQuiet(): boolean {
  return process.argv.includes('--quiet');
}

export function isJson(): boolean {
  return process.argv.includes('--json');
}
