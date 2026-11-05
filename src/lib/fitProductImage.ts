const OUT_W = 216;
const OUT_H = 168;
const MARGIN = 0.08;
const cache = new Map<string, Promise<string>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    img.src = src;
  });
}

function isBackdrop(data: Uint8ClampedArray, index: number) {
  const alpha = data[index + 3];
  if (alpha < 24) return true;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return r > 246 && g > 246 && b > 246;
}

function contentBounds(data: Uint8ClampedArray, width: number, height: number) {
  const empty = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * width + x;
    if (empty[i] || !isBackdrop(data, i * 4)) return;
    empty[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x + 1 < width) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < height) push(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (empty[i] || data[i * 4 + 3] < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function render(src: string) {
  const img = await loadImage(src);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) return src;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return src;
  sourceCtx.drawImage(img, 0, 0);
  const bounds = contentBounds(sourceCtx.getImageData(0, 0, width, height).data, width, height);
  if (!bounds) return src;

  const maxW = OUT_W * (1 - MARGIN * 2);
  const maxH = OUT_H * (1 - MARGIN * 2);
  const scale = Math.min(maxW / bounds.w, maxH / bounds.h);
  const drawW = bounds.w * scale;
  const drawH = bounds.h * scale;
  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const outCtx = out.getContext('2d');
  if (!outCtx) return src;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(source, bounds.x, bounds.y, bounds.w, bounds.h, (OUT_W - drawW) / 2, (OUT_H - drawH) / 2, drawW, drawH);
  return out.toDataURL('image/png');
}

export function fitProductImage(src: string) {
  const cached = cache.get(src);
  if (cached) return cached;
  const pending = render(src).catch(() => src);
  cache.set(src, pending);
  return pending;
}
