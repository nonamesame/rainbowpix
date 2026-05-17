import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export async function generateImage(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number
): Promise<string> {
  const output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
    input: {
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
    },
  });

  return Array.isArray(output) ? String(output[0]) : String(output);
}
