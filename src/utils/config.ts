import fs from "fs-extra";
import path from "node:path";
import type { OimgxConfig } from "../types.js";

export const loadConfig = async (cwd: string): Promise<OimgxConfig> => {
  const configTs = path.join(cwd, "oimgx.config.ts");
  const configJs = path.join(cwd, "oimgx.config.js");

  if (await fs.pathExists(configTs)) {
    const mod = await import(pathToFileUrl(configTs));
    return mod.default ?? mod.config ?? {};
  }

  if (await fs.pathExists(configJs)) {
    const mod = await import(pathToFileUrl(configJs));
    return mod.default ?? mod.config ?? {};
  }

  return {};
};

const pathToFileUrl = (targetPath: string): string => {
  const absolute = path.resolve(targetPath);
  return `file://${absolute}`;
};
