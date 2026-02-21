import fs from "fs-extra";
import path from "node:path";
import type { AssetDetectionResult, DetectionResult, FrameworkType } from "./types.js";

interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const frameworkAssetPriority: Record<FrameworkType, string[]> = {
  next: ["public", "public/images", "app", "src/assets", "src/images"],
  react: ["public", "src/assets", "src/images", "assets"],
  angular: ["src/assets"],
  vue: ["public", "src/assets"],
  custom: ["public", "assets", "src/assets", "images"],
};

const readPackageJson = async (cwd: string): Promise<PackageJsonLike> => {
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fs.pathExists(pkgPath))) return {};
  return fs.readJson(pkgPath);
};

const hasDep = (pkg: PackageJsonLike, dep: string): boolean => Boolean(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]);

export const detectFramework = async (cwd: string): Promise<DetectionResult> => {
  const pkg = await readPackageJson(cwd);

  const checks: Array<{ framework: FrameworkType; score: number; reason: string; matched: boolean }> = [
    {
      framework: "next",
      score: 4,
      reason: "Found next.config.js",
      matched: await fs.pathExists(path.join(cwd, "next.config.js")),
    },
    {
      framework: "next",
      score: 4,
      reason: "Found next dependency",
      matched: hasDep(pkg, "next"),
    },
    {
      framework: "next",
      score: 2,
      reason: "Found app/pages directory",
      matched: (await fs.pathExists(path.join(cwd, "app"))) || (await fs.pathExists(path.join(cwd, "pages"))),
    },
    {
      framework: "react",
      score: 4,
      reason: "Found react dependency",
      matched: hasDep(pkg, "react"),
    },
    {
      framework: "react",
      score: 2,
      reason: "Found React entrypoint",
      matched:
        (await fs.pathExists(path.join(cwd, "src", "App.tsx"))) ||
        (await fs.pathExists(path.join(cwd, "src", "index.tsx"))),
    },
    {
      framework: "react",
      score: 2,
      reason: "Found Vite/CRA structure",
      matched:
        (await fs.pathExists(path.join(cwd, "vite.config.ts"))) ||
        (await fs.pathExists(path.join(cwd, "vite.config.js"))) ||
        (await fs.pathExists(path.join(cwd, "public", "index.html"))),
    },
    {
      framework: "angular",
      score: 5,
      reason: "Found angular.json",
      matched: await fs.pathExists(path.join(cwd, "angular.json")),
    },
    {
      framework: "angular",
      score: 4,
      reason: "Found @angular/core dependency",
      matched: hasDep(pkg, "@angular/core"),
    },
    {
      framework: "vue",
      score: 4,
      reason: "Found vue dependency",
      matched: hasDep(pkg, "vue"),
    },
    {
      framework: "vue",
      score: 2,
      reason: "Found vue.config.js",
      matched: await fs.pathExists(path.join(cwd, "vue.config.js")),
    },
    {
      framework: "vue",
      score: 2,
      reason: "Found vite config",
      matched:
        (await fs.pathExists(path.join(cwd, "vite.config.ts"))) ||
        (await fs.pathExists(path.join(cwd, "vite.config.js"))),
    },
  ];

  const scores = new Map<FrameworkType, number>();
  const reasons = new Map<FrameworkType, string[]>();

  for (const check of checks) {
    if (!check.matched) continue;
    scores.set(check.framework, (scores.get(check.framework) ?? 0) + check.score);
    reasons.set(check.framework, [...(reasons.get(check.framework) ?? []), check.reason]);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [framework, score] = ranked[0] ?? ["custom", 0];

  return {
    framework,
    confidence: score,
    reasons: reasons.get(framework) ?? ["No framework markers found"],
  };
};

const readAngularAssetPaths = async (cwd: string): Promise<string[]> => {
  const angularPath = path.join(cwd, "angular.json");
  if (!(await fs.pathExists(angularPath))) return [];

  const raw = await fs.readJson(angularPath);
  const projects = raw.projects ?? {};
  const output = new Set<string>();

  for (const project of Object.values<any>(projects)) {
    const assets = project?.architect?.build?.options?.assets;
    if (!Array.isArray(assets)) continue;
    for (const item of assets) {
      if (typeof item === "string") output.add(item);
      if (item && typeof item.input === "string") output.add(item.input);
    }
  }

  return [...output];
};

export const detectAssetsFolder = async (cwd: string, framework: FrameworkType): Promise<AssetDetectionResult> => {
  const priorities = frameworkAssetPriority[framework];
  const found = new Set<string>();

  for (const rel of priorities) {
    if (await fs.pathExists(path.join(cwd, rel))) found.add(rel);
  }

  if (framework === "angular") {
    const angularAssets = await readAngularAssetPaths(cwd);
    for (const rel of angularAssets) {
      if (await fs.pathExists(path.join(cwd, rel))) found.add(rel);
    }
  }

  return {
    candidates: [...found],
    selected: found.size === 1 ? [...found][0] : undefined,
  };
};
