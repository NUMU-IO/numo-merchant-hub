import QRCode from "qrcode";

const W = 1080;
const H = 1920;

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, max: number, family: string) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 4;
  } while (ctx.measureText(text).width > max && size > 28);
}

/** A 1080×1920 story image of the store: name, link and a QR that opens it. */
export async function makeStoryImage(opts: { url: string; storeName?: string; isAr: boolean }): Promise<Blob> {
  const { url, storeName, isAr } = opts;
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const family = isAr ? '"IBM Plex Sans Arabic", "Tajawal", sans-serif' : '"Space Grotesk", "Inter", sans-serif';

  ctx.fillStyle = "#001F3F";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#E8A430";
  ctx.fillRect(0, 0, W, 18);

  ctx.textAlign = "center";
  ctx.direction = isAr ? "rtl" : "ltr";
  ctx.fillStyle = "#F7F1E3";

  const title = storeName || (isAr ? "متجري" : "My store");
  fitFont(ctx, title, 800, 112, W - 140, family);
  ctx.fillText(title, W / 2, 520);

  ctx.font = `500 52px ${family}`;
  ctx.fillStyle = "rgba(247, 241, 227, 0.75)";
  ctx.fillText(isAr ? "اطلب دلوقتي من متجري" : "Order now from my store", W / 2, 620);

  const qr = new Image();
  qr.src = await QRCode.toDataURL(url, { width: 560, margin: 2, color: { dark: "#001F3F", light: "#FFFFFF" } });
  await qr.decode();
  const qrSize = 560;
  const qrX = (W - qrSize) / 2;
  const qrY = 780;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(qrX - 30, qrY - 30, qrSize + 60, qrSize + 60, 36);
  ctx.fill();
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  const display = url.replace(/^https?:\/\//, "");
  ctx.direction = "ltr";
  ctx.fillStyle = "#E8A430";
  fitFont(ctx, display, 700, 56, W - 140, '"Space Grotesk", "Inter", sans-serif');
  ctx.fillText(display, W / 2, 1520);

  ctx.direction = isAr ? "rtl" : "ltr";
  ctx.font = `500 40px ${family}`;
  ctx.fillStyle = "rgba(247, 241, 227, 0.6)";
  ctx.fillText(isAr ? "صوّر الكود أو افتح الرابط" : "Scan the code or open the link", W / 2, 1610);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
