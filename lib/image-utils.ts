export async function imageToDataUrl(file: File, maxEdge = 1600, quality = 0.9): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Seleziona un'immagine JPG, PNG o WEBP.");
  }
  if (file.size > 35 * 1024 * 1024) {
    throw new Error("L'immagine supera il limite di 35 MB.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossibile elaborare questa immagine.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function sanitizeFileName(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "gioiello";
}

export async function downloadZip(title: string, images: { id: string; data: string }[]): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  images.forEach(({ id, data }) => {
    const payload = data.split(",")[1];
    zip.file(sanitizeFileName(title) + "-" + id + ".png", payload, { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFileName(title) + "-adamante.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
