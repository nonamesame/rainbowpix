import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export async function generateImage(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  referenceImageUrl?: string,
): Promise<string> {
  const input: Record<string, any> = {
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
  };

  if (referenceImageUrl) {
    input.image = referenceImageUrl;
    input.prompt_strength = 0.75;
  }

  const output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
    input,
  });

  const value = Array.isArray(output) ? output[0] : output;

  // Replicate SDK may return a FileOutput (extends ReadableStream) instead of a URL string
  if (value instanceof ReadableStream) {
    const text = await new Response(value).text();
    return text.trim();
  }

  return String(value);
}
