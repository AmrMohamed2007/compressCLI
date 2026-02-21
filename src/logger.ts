import chalk from "chalk";

export class Logger {
  constructor(private readonly jsonMode: boolean) {}

  info(message: string): void {
    if (!this.jsonMode) console.log(message);
  }

  success(message: string): void {
    if (!this.jsonMode) console.log(chalk.green(message));
  }

  warn(message: string): void {
    if (!this.jsonMode) console.warn(chalk.yellow(message));
  }

  error(message: string): void {
    if (!this.jsonMode) console.error(chalk.red(message));
  }
}
