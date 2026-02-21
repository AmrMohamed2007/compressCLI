import inquirer from "inquirer";
import type { FrameworkType } from "./types.js";

export const selectAssetsCandidate = async (candidates: string[]): Promise<string | undefined> => {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const { selected } = await inquirer.prompt<{ selected: string }>([
    {
      type: "list",
      name: "selected",
      message: "Multiple asset folders were detected. Select one:",
      choices: candidates,
    },
  ]);

  return selected;
};

export const askManualAssetsPath = async (): Promise<string> => {
  const { selected } = await inquirer.prompt<{ selected: string }>([
    {
      type: "input",
      name: "selected",
      message: "No asset folder found automatically. Enter path manually:",
      validate: (val: string) => (val.trim() ? true : "Path is required"),
    },
  ]);

  return selected;
};

export const confirmDetectedTarget = async (framework: FrameworkType, assets: string): Promise<boolean> => {
  const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
    {
      type: "confirm",
      name: "proceed",
      default: true,
      message: `Detected Project: ${framework}\nDetected Assets Folder: ${assets}\nProceed?`,
    },
  ]);

  return proceed;
};
