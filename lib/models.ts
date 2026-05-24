export interface Model {
  id: string;
  name: string;
  description: string;
  supportedAspectRatios: string[];
  creditCost: number;
  supportsReferenceImage: boolean;
  maxReferenceImages: number;
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
    "3:4": { w: 768, h: 1024 },
    "4:3": { w: 1024, h: 768 },
    "9:16": { w: 576, h: 1024 },
    "16:9": { w: 1024, h: 576 },
  },
  "gpt-image-2": {
    "1:1": { w: 1024, h: 1024 },
    "3:4": { w: 1024, h: 1792 },
    "4:3": { w: 1792, h: 1024 },
    "9:16": { w: 1024, h: 1792 },
    "16:9": { w: 1792, h: 1024 },
  },
};

export function getPixelSize(aspectRatio: string, modelId: string): { w: number; h: number } {
  const modelMap = SIZE_MAP[modelId] || SIZE_MAP["jimeng-4.0"];
  return modelMap[aspectRatio] || modelMap["1:1"];
}

export function widthHeightToAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const normalized = `${width / d}:${height / d}`;
  const knownRatios: Record<string, string> = {
    "1:1": "1:1",
    "3:4": "3:4",
    "4:3": "4:3",
    "9:16": "9:16",
    "16:9": "16:9",
  };
  return knownRatios[normalized] || "1:1";
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
  },
  {
    id: "jimeng-4.0",
    name: "即梦4.0",
    description: "字节跳动推出的AI绘画模型，擅长生成高质量的图像",
    supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    creditCost: 1,
    supportsReferenceImage: false,
    maxReferenceImages: 0,
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    description: "OpenAI推出的图像生成模型，具有强大的理解能力",
    supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    creditCost: 3,
    supportsReferenceImage: true,
    maxReferenceImages: 4,
  },
];
