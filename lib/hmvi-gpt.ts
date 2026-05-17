import axios from "axios";
import { createClient } from "./supabase/server";

export async function generateImage(
  prompt: string,
  size: string
): Promise<string> {
  const response = await axios.post(
    `${process.env.HMVI_BASE_URL}/images/generations`,
    { prompt, size },
    {
      headers: {
        Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const b64 = response.data.data[0].b64_json;
  const buffer = Buffer.from(b64, "base64");

  const supabase = await createClient();
  const fileName = `hmvi-${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from("generated-images")
    .upload(fileName, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("generated-images").getPublicUrl(data.path);

  return publicUrl;
}
