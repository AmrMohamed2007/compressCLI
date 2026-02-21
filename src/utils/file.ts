import { createHash } from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

export const isImageFile = (filePath: string): boolean => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const hashFile = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath);
  return createHash("sha1").update(buffer).digest("hex");
};

export const normalizeRelative = (cwd: string, targetPath: string): string => {
  const rel = path.relative(cwd, targetPath);
  return rel || ".";
};
