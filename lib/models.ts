export interface Model {
  id: string;
  name: string;
  description: string;
  supportedSizes: string[];
  creditCost: number;
}

export const models: Model[] = [
  {
    id: "jimeng-4.0",
    name: "即梦4.0",
    description: "字节跳动推出的AI绘画模型，擅长生成高质量的图像",
    supportedSizes: ["1024x1024", "768x1024", "1024x768"],
    creditCost: 1,
  },
  {
    id: "sdxl",
    name: "Stable Diffusion XL",
    description: "Stability AI推出的开源图像生成模型，支持多种风格",
    supportedSizes: ["1024x1024", "768x1024", "1024x768", "512x512"],
    creditCost: 2,
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    description: "OpenAI推出的图像生成模型，具有强大的理解能力",
    supportedSizes: ["1024x1024", "1024x1792", "1792x1024"],
    creditCost: 3,
  },
];
