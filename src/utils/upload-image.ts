import { supabase } from "@/services/supabase-client";

/**
 * Envoi des images dans le Storage Supabase.
 *
 * Remplace ImgBB et Litterbox : le premier demandait une clé d'API publiée
 * dans le bundle, le second effaçait les fichiers au bout de 24 heures.
 */
const BUCKET = "attachments";

/** Nom de fichier sûr et unique, l'original pouvant contenir n'importe quoi. */
function buildPath(file: File): string {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "bin";
  return `uploads/${crypto.randomUUID()}.${extension || "bin"}`;
}

export async function uploadImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Seules les images sont acceptées");
  }

  const path = buildPath(file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("Upload image error:", error);
    throw new Error("Échec de l'envoi de l'image");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImageFiles(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImageFile(file)));
}
