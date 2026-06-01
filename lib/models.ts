export interface Model {
  id: string;
  name: string;
  description: string;
  supportedAspectRatios: string[];
  creditCost: number;
  supportsReferenceImage: boolean;
  maxReferenceImages: number;
  /** When true, model is excluded from user-facing selection UI. */
  hidden?: boolean;
}

export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;

// Map aspect ratio to pixel dimensions per model
const SIZE_MAP: Record<string, Record<string, { w: number; h: number }>> = {
  "jimeng-3.0": {
    "1:1": { w: 1024, h: 1024 },
    "3:4": { w: 768, h: 1024 },
    "4:3": { w: 1024, h: 768 },
    "9:16": { w: 576, h: 1024 },
    "16:9": { w: 1024, h: 576 },
  },
  "jimeng-4.0": {
    "1:1": { w: 1024, h: 1024 },
  },
  "gpt-image-2": {
    "1:1": { w: 1024, h: 1024 },
    "3:4": { w: 1024, h: 1792 },
    "4:3": { w: 1792, h: 1024 },
    "9:16": { w: 1024, h: 1792 },
    "16:9": { w: 1792, h: 1024 },
  },
  "z-image-turbo": {
    "1:1": { w: 1024, h: 1024 },
    "3:4": { w: 768, h: 1024 },
    "4:3": { w: 1024, h: 768 },
    "9:16": { w: 576, h: 1024 },
    "16:9": { w: 1024, h: 576 },
  },
};

export function getPixelSize(aspectRatio: string, modelId: string): { w: number; h: number } {
  const modelMap = SIZE_MAP[modelId] || SIZE_MAP["jimeng-4.0"];
  return modelMap[aspectRatio] || modelMap["1:1"];
}

export function widthHeightToAspectRatio(width: number, height: number): string {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  // Use approximate matching — GPT Image 2 uses 1792×1024 which normalizes to 7:4 via GCD,
  // but actually represents 16:9. Approximate matching handles such non-integer-ratio pixel sizes.
  const knownRatios: { label: string; value: number }[] = [
    { label: "1:1", value: 1 },
    { label: "3:4", value: 3 / 4 },
    { label: "4:3", value: 4 / 3 },
    { label: "9:16", value: 9 / 16 },
    { label: "16:9", value: 16 / 9 },
  ];
  for (const kr of knownRatios) {
    if (Math.abs(ratio - kr.value) / kr.value < 0.02) return kr.label;
  }
  return "1:1";
}

export const models: Model[] = [
  {
    id: "jimeng-3.0",
    name: "即梦3.0",
    description: "字节跳动推出的AI绘画模型，擅长生成高质量的图像",
    supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    creditCost: 1,
    supportsReferenceImage: false,
    maxReferenceImages: 0,
    hidden: true,
  },
  {
    id: "jimeng-4.0",
    name: "即梦4.0",
    description: "字节跳动推出的AI绘画模型，擅长生成高质量的图像（仅支持1:1）",
    supportedAspectRatios: ["1:1"],
    creditCost: 1,
    supportsReferenceImage: false,
    maxReferenceImages: 0,
    hidden: true,
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    description: "OpenAI推出的图像生成模型，具有强大的理解能力",
    supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    creditCost: 1,
    supportsReferenceImage: true,
    maxReferenceImages: 4,
  },
  {
    id: "z-image-turbo",
    name: "造相 Z-Image-Turbo",
    description: "通义万相快速版，生图速度快，每日免费2000次",
    supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    creditCost: 0,
    supportsReferenceImage: false,
    maxReferenceImages: 0,
  },
];
