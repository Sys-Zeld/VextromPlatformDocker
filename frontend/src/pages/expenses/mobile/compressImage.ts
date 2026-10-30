// Foto de celular tem 3–12 MB e às vezes vem em HEIC. Antes do envio, reduz
// para no máximo MAX_SIDE px em JPEG — cabe no limite do módulo, sobe rápido
// no 4G e continua legível. PDFs e arquivos pequenos em formato aceito passam
// intactos; se o navegador não conseguir decodificar, devolve o original.
const MAX_SIDE = 2000;
const QUALITY = 0.82;
const KEEP_BELOW_BYTES = 1.5 * 1024 * 1024;

export async function compressImage(file: File, allowedExtensions: string[]): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (allowedExtensions.includes(ext) && file.size <= KEEP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" aplica a rotação do EXIF (foto em pé continua em pé).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // Fundo branco: PNG com transparência não vira preto no JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob || (blob.size >= file.size && allowedExtensions.includes(ext))) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "recibo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

// Pré-visualização como data: URL — a CSP do SPA não libera blob: em img-src.
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
