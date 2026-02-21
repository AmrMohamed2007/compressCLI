import type { PresetName, PresetOptions } from "./types.js";

export const PRESETS: Record<Exclude<PresetName, "custom">, PresetOptions> = {
  aggressive: {
    quality: 62,
    pngCompressionLevel: 9,
    effort: 8,
    lossless: false,
  },
  balanced: {
    quality: 78,
    pngCompressionLevel: 8,
    effort: 6,
    lossless: false,
  },
  "high-quality": {
    quality: 90,
    pngCompressionLevel: 7,
    effort: 4,
    lossless: false,
  },
};

export const resolvePreset = (preset: PresetName | undefined, fallbackQuality: number): PresetOptions => {
  if (!preset || preset === "custom") {
    return {
      quality: fallbackQuality,
      pngCompressionLevel: 8,
      effort: 6,
      lossless: false,
    };
  }

  return PRESETS[preset];
};
