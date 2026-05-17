import axios from "axios";
import { createClient } from "./supabase/server";

export async function downloadAndUpload(
  tempUrl: string,
  fileName: string
): Promise<string> {
  const response = await axios.get(tempUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("generated-images")
    .upload(fileName, buffer, {
      contentType: (response.headers["content-type"] as string) || "image/png",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("generated-images").getPublicUrl(data.path);

  return publicUrl;
}
