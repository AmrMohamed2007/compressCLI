export type FrameworkType = "next" | "react" | "angular" | "vue" | "custom";
export type OutputFormat = "original" | "png" | "jpeg" | "webp" | "avif";
export type PresetName = "aggressive" | "balanced" | "high-quality" | "custom";

export interface DetectionResult {
  framework: FrameworkType;
  confidence: number;
  reasons: string[];
}

export interface AssetDetectionResult {
  candidates: string[];
  selected?: string;
}

export interface PresetOptions {
  quality: number;
  pngCompressionLevel: number;
  effort: number;
  lossless: boolean;
}

export interface OimgxConfig {
  input?: string;
  output?: string;
  format?: OutputFormat;
  recursive?: boolean;
  quality?: number;
  preset?: PresetName;
  include?: string[];
  exclude?: string[];
  ci?: boolean;
  json?: boolean;
  concurrency?: number;
}

export interface CliOptions extends OimgxConfig {
  cwd: string;
  yes?: boolean;
}

export interface OptimizationStats {
  filesProcessed: number;
  skipped: number;
  beforeBytes: number;
  afterBytes: number;
  duplicatesSkipped: number;
  startedAt: number;
  endedAt: number;
  framework: FrameworkType;
  assetsPath: string;
}

export interface OptimizeJob {
  sourcePath: string;
  targetPath: string;
}
