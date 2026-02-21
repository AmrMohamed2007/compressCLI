import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { glob } from "glob";
import sharp from "sharp";
import type { CliOptions, OptimizeJob, OptimizationStats } from "./types.js";
import { resolvePreset } from "./presets.js";
import { hashFile, isImageFile } from "./utils/file.js";
import { runWithConcurrency } from "./utils/async.js";

const buildTargetPath = (sourcePath: string, sourceRoot: string, outputRoot: string, format: CliOptions["format"]): string => {
  const rel = path.relative(sourceRoot, sourcePath);
  const parsed = path.parse(rel);
  const ext = format && format !== "original" ? `.${format === "jpeg" ? "jpg" : format}` : parsed.ext;
  return path.join(outputRoot, parsed.dir, `${parsed.name}${ext}`);
};

const optimizeBuffer = async (input: Buffer, ext: string, options: CliOptions): Promise<Buffer> => {
  const preset = resolvePreset(options.preset, options.quality ?? 78);
  const format = options.format ?? "original";
  const base = sharp(input, { animated: false }).rotate();

  const output = format === "original" ? ext.replace(".", "") : format;

  switch (output) {
    case "png":
      return base.png({
        quality: preset.quality,
        compressionLevel: preset.pngCompressionLevel,
        effort: preset.effort,
        palette: false,
      }).toBuffer();
    case "jpg":
    case "jpeg":
      return base.jpeg({
        quality: preset.quality,
        mozjpeg: true,
      }).toBuffer();
    case "webp":
      return base.webp({
        quality: preset.quality,
        effort: preset.effort,
        alphaQuality: Math.max(preset.quality, 85),
        lossless: preset.lossless,
      }).toBuffer();
    case "avif":
      return base.avif({
        quality: preset.quality,
        effort: preset.effort,
      }).toBuffer();
    default:
      return input;
  }
};

export const collectImageJobs = async (sourceRoot: string, outputRoot: string, options: CliOptions): Promise<OptimizeJob[]> => {
  const files = await glob("**/*", {
    cwd: sourceRoot,
    nodir: true,
    ignore: options.exclude,
    absolute: true,
  });

  return files.filter(isImageFile).map((sourcePath: string) => ({
    sourcePath,
    targetPath: buildTargetPath(sourcePath, sourceRoot, outputRoot, options.format),
  }));
};

export const optimizeImages = async (
  jobs: OptimizeJob[],
  framework: OptimizationStats["framework"],
  assetsPath: string,
  options: CliOptions,
): Promise<OptimizationStats> => {
  const startedAt = Date.now();
  const seenHashes = new Set<string>();

  const stats: OptimizationStats = {
    filesProcessed: 0,
    skipped: 0,
    beforeBytes: 0,
    afterBytes: 0,
    duplicatesSkipped: 0,
    startedAt,
    endedAt: startedAt,
    framework,
    assetsPath,
  };

  const concurrency = options.concurrency ?? Math.max(2, Math.min(8, os.cpus().length));

  await runWithConcurrency(jobs, concurrency, async (job) => {
    const original = await fs.readFile(job.sourcePath);
    const before = original.length;
    stats.beforeBytes += before;

    const hash = await hashFile(job.sourcePath);
    if (seenHashes.has(hash)) {
      stats.skipped += 1;
      stats.duplicatesSkipped += 1;
      return;
    }
    seenHashes.add(hash);

    const optimized = await optimizeBuffer(original, path.extname(job.sourcePath).toLowerCase(), options);
    if (optimized.length >= before) {
      stats.skipped += 1;
      stats.afterBytes += before;
      return;
    }

    await fs.ensureDir(path.dirname(job.targetPath));
    await fs.writeFile(job.targetPath, optimized);

    stats.filesProcessed += 1;
    stats.afterBytes += optimized.length;
  });

  stats.endedAt = Date.now();
  return stats;
};
