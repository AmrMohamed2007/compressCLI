#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs-extra";
import ora from "ora";
import { detectAssetsFolder, detectFramework } from "./detector.js";
import { Logger } from "./logger.js";
import { optimizeImages, collectImageJobs } from "./optimizer.js";
import type { CliOptions, OimgxConfig, OutputFormat, PresetName } from "./types.js";
import { formatBytes, normalizeRelative } from "./utils/file.js";
import { loadConfig } from "./utils/config.js";
import { askManualAssetsPath, confirmDetectedTarget, selectAssetsCandidate } from "./wizard.js";

const program = new Command();

program
  .name("oimgx")
  .description("Framework-aware image optimization CLI")
  .option("-i, --input <path>", "Assets input directory")
  .option("-o, --output <path>", "Output directory (defaults to input path)")
  .option("-f, --format <format>", "Output format: original|png|jpeg|webp|avif", "original")
  .option("-q, --quality <number>", "Compression quality (0-100)", "78")
  .option("-p, --preset <preset>", "Preset: aggressive|balanced|high-quality|custom", "balanced")
  .option("--include <glob...>", "Include patterns")
  .option("--exclude <glob...>", "Exclude patterns")
  .option("--concurrency <n>", "Parallel optimization workers")
  .option("--ci", "Non-interactive CI mode")
  .option("--json", "Machine-readable JSON output")
  .option("-y, --yes", "Skip confirmation prompts in interactive mode")
  .action(async (rawOpts: Record<string, unknown>) => {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const options = mergeOptions(cwd, config, rawOpts);
    const logger = new Logger(Boolean(options.json));

    try {
      const spinner = ora({ text: "Analyzing project", isSilent: Boolean(options.json) }).start();

      const detected = await detectFramework(cwd);
      let input = options.input;

      if (!input) {
        const assets = await detectAssetsFolder(cwd, detected.framework);
        input = assets.selected ?? (await handleAssetSelection(assets.candidates, options));
      }

      if (!input) {
        spinner.fail("Could not determine assets directory");
        process.exitCode = 2;
        return;
      }

      const inputPath = path.resolve(cwd, input);
      const outputPath = path.resolve(cwd, options.output ?? input);

      if (!(await fs.pathExists(inputPath))) {
        spinner.fail(`Input path does not exist: ${input}`);
        process.exitCode = 2;
        return;
      }

      if (!options.ci && !options.yes && !options.json && !options.input) {
        spinner.stop();
        const proceed = await confirmDetectedTarget(detected.framework, normalizeRelative(cwd, inputPath));
        if (!proceed) {
          logger.warn("Cancelled by user.");
          process.exitCode = 130;
          return;
        }
        spinner.start();
      }

      spinner.text = "Collecting image files";
      const jobs = await collectImageJobs(inputPath, outputPath, options);

      if (jobs.length === 0) {
        spinner.warn("No image files found.");
        process.exitCode = 0;
        return;
      }

      spinner.text = `Optimizing ${jobs.length} images`;
      const stats = await optimizeImages(jobs, detected.framework, normalizeRelative(cwd, inputPath), options);
      spinner.succeed("Optimization complete");

      const savedPercent =
        stats.beforeBytes === 0 ? 0 : ((stats.beforeBytes - stats.afterBytes) / stats.beforeBytes) * 100;
      const elapsed = ((stats.endedAt - stats.startedAt) / 1000).toFixed(1);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              framework: stats.framework,
              assets: stats.assetsPath,
              filesProcessed: stats.filesProcessed,
              skipped: stats.skipped,
              duplicatesSkipped: stats.duplicatesSkipped,
              sizeBefore: stats.beforeBytes,
              sizeAfter: stats.afterBytes,
              savedPercent: Number(savedPercent.toFixed(2)),
              durationSeconds: Number(elapsed),
            },
            null,
            2,
          ),
        );
      } else {
        console.log(chalk.gray("────────────────────────────"));
        console.log(` Framework: ${stats.framework}`);
        console.log(` Assets: ${stats.assetsPath}`);
        console.log(` Files Processed: ${stats.filesProcessed}`);
        console.log(` Skipped: ${stats.skipped}`);
        console.log(` Size Before: ${formatBytes(stats.beforeBytes)}`);
        console.log(` Size After: ${formatBytes(stats.afterBytes)}`);
        console.log(` Saved: ${savedPercent.toFixed(1)}%`);
        console.log(` Time: ${elapsed}s`);
        console.log(chalk.gray("────────────────────────────"));
      }

      process.exitCode = stats.filesProcessed > 0 ? 0 : 3;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : "Unknown error");
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);

const mergeOptions = (cwd: string, config: OimgxConfig, cli: Record<string, unknown>): CliOptions => ({
  cwd,
  input: String(cli.input ?? config.input ?? "") || undefined,
  output: String(cli.output ?? config.output ?? "") || undefined,
  format: asFormat(cli.format ?? config.format ?? "original"),
  quality: Number(cli.quality ?? config.quality ?? 78),
  preset: asPreset(cli.preset ?? config.preset ?? "balanced"),
  include: (cli.include as string[] | undefined) ?? config.include,
  exclude: (cli.exclude as string[] | undefined) ?? config.exclude,
  concurrency: Number(cli.concurrency ?? config.concurrency ?? 0) || undefined,
  recursive: Boolean(cli.recursive ?? config.recursive ?? true),
  ci: Boolean(cli.ci ?? config.ci),
  json: Boolean(cli.json ?? config.json),
  yes: Boolean(cli.yes),
});

const asFormat = (value: unknown): OutputFormat => {
  const normalized = String(value).toLowerCase();
  if (["original", "png", "jpeg", "webp", "avif"].includes(normalized)) return normalized as OutputFormat;
  throw new Error(`Unsupported format: ${normalized}`);
};

const asPreset = (value: unknown): PresetName => {
  const normalized = String(value).toLowerCase();
  if (["aggressive", "balanced", "high-quality", "custom"].includes(normalized)) return normalized as PresetName;
  throw new Error(`Unsupported preset: ${normalized}`);
};

const handleAssetSelection = async (candidates: string[], options: CliOptions): Promise<string | undefined> => {
  if (options.ci) return candidates[0];
  const selected = await selectAssetsCandidate(candidates);
  if (selected) return selected;
  return askManualAssetsPath();
};
