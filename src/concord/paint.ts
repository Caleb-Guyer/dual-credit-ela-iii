import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export type PaintedSurface =
  'plaster' | 'wood' | 'slate' | 'stone' | 'road' | 'cloth' | 'paper' | 'brick';

/** Small, original painted studies, drawn locally rather than downloaded or generated as images. */
export function paintTexture(kind: PaintedSurface, color: string, seed = 1): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  let state = (seed * 713 + 1913) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rgb = color.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  const tint = (amount: number, alpha = 1) =>
    `rgba(${channels.map((v) => Math.round(Math.max(0, Math.min(255, v + amount)))).join(',')},${alpha})`;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);

  // Translucent washes sit beneath the line work. Their scale is large enough to read as paint.
  for (let i = 0; i < 34; i++) {
    ctx.fillStyle = tint((random() - 0.5) * 24, 0.16);
    const x = random() * 512;
    const y = random() * 512;
    ctx.beginPath();
    ctx.ellipse(x, y, 35 + random() * 95, 8 + random() * 24, random() * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  const stroke = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    shade: number,
    width = 1,
    alpha = 0.2,
  ) => {
    ctx.strokeStyle = tint(shade, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  if (kind === 'plaster') {
    for (let i = 0; i < 170; i++) {
      const x = random() * 512;
      const y = random() * 512;
      stroke(
        x,
        y,
        x + 14 + random() * 110,
        y + random() * 2,
        random() > 0.5 ? 30 : -28,
        0.7 + random() * 1.7,
        0.13,
      );
    }
    // Fine dry-brush marks make the surface chalky without turning it into television noise.
    for (let i = 0; i < 400; i++) {
      const x = random() * 512;
      const y = random() * 512;
      stroke(x, y, x + random() * 7, y, -32, 0.6, 0.13);
    }
  } else if (kind === 'wood') {
    for (let x = 0; x <= 512; x += 64) {
      stroke(x + 1, 0, x + 1, 512, -52, 2, 0.35);
      stroke(x + 3, 0, x + 3, 512, 41, 1, 0.26);
    }
    for (let i = 0; i < 85; i++) {
      const x = random() * 512;
      const y = random() * 512;
      ctx.strokeStyle = tint(random() > 0.35 ? -39 : 48, 0.21);
      ctx.lineWidth = 0.5 + random() * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 5, y + 50, x + 7, y + 80, x + 2, y + 150);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const x = 18 + random() * 475;
      const y = random() * 512;
      ctx.strokeStyle = tint(-46, 0.24);
      ctx.lineWidth = 1.2;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + ring * 3, 9 + ring * 7, 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (kind === 'slate') {
    const w = 64;
    const h = 74;
    for (let row = -1; row < 8; row++) {
      const shift = row % 2 ? -32 : 0;
      for (let col = -1; col < 9; col++) {
        const x = col * w + shift;
        const y = row * h;
        ctx.fillStyle = tint((random() - 0.5) * 24, 0.9);
        ctx.fillRect(x + 1, y, w - 2, h - 2);
        stroke(x, y + h - 1, x + w, y + h - 1, -44, 2, 0.5);
        stroke(x + 2, y + 6, x + 2, y + h - 1, -35, 1, 0.45);
        stroke(x + 6, y + h - 4, x + w - 7, y + h - 4, 48, 1, 0.26);
        for (let mark = 0; mark < 3; mark++) {
          const mx = x + 8 + random() * 43;
          stroke(mx, y + 14, mx - 4, y + 55, 36, 0.7, 0.16);
        }
      }
    }
  } else if (kind === 'brick' || kind === 'stone') {
    const h = kind === 'brick' ? 51.2 : 85.33;
    const w = kind === 'brick' ? 128 : 170.66;
    ctx.fillStyle = kind === 'brick' ? tint(62) : tint(-30);
    ctx.fillRect(0, 0, 512, 512);
    for (let row = -1; row < 11; row++) {
      for (let col = -1; col < 6; col++) {
        const x = col * w + (row % 2 ? -w / 2 : 0);
        const y = row * h;
        ctx.fillStyle = tint((random() - 0.5) * 27);
        ctx.beginPath();
        const wiggle = kind === 'stone' ? 4 : 1;
        ctx.moveTo(x + 3 + random() * wiggle, y + 3);
        ctx.lineTo(x + w - 3, y + 3 + random() * wiggle);
        ctx.lineTo(x + w - 3 - random() * wiggle, y + h - 3);
        ctx.lineTo(x + 3, y + h - 3 - random() * wiggle);
        ctx.closePath();
        ctx.fill();
        stroke(x + 6, y + h - 6, x + w - 8, y + h - 6, -35, 1.3, 0.25);
        stroke(x + 7, y + 7, x + w - 8, y + 7, 43, 1.2, 0.26);
        for (let mark = 0; mark < 5; mark++) {
          const mx = x + random() * w;
          const my = y + random() * h;
          stroke(mx, my, mx + 6 + random() * 25, my + 1, -27, 0.8, 0.14);
        }
      }
    }
  } else if (kind === 'road') {
    // Broad compacted tracks read as a travelled road; small pebbles remain subordinate.
    for (const x of [137, 357]) {
      const gradient = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
      gradient.addColorStop(0, tint(14, 0));
      gradient.addColorStop(0.5, tint(23, 0.42));
      gradient.addColorStop(1, tint(14, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 34, 0, 68, 512);
    }
    for (let i = 0; i < 230; i++) {
      const x = random() * 512;
      const y = random() * 512;
      const size = 2 + random() * 6;
      ctx.fillStyle = tint((random() - 0.45) * 40, 0.65);
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.4);
      ctx.lineTo(x + size * 0.9, y);
      ctx.lineTo(x + size * 0.5, y + size * 0.6);
      ctx.lineTo(x - size * 0.3, y + size * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 180; i++) {
      const x = random() * 512;
      const y = random() * 512;
      stroke(x, y, x + 4 + random() * 11, y + random() * 2, -38, 0.7, 0.15);
    }
  } else if (kind === 'cloth') {
    for (let i = 0; i <= 512; i += 4) {
      stroke(i + 0.5, 0, i + 0.5, 512, -24, 1, 0.24);
      stroke(0, i + 0.5, 512, i + 0.5, 33, 1.5, 0.22);
    }
    for (let i = 0; i < 30; i++) {
      const y = random() * 512;
      stroke(0, y, 512, y + 2, -21, 2, 0.12);
    }
  } else if (kind === 'paper') {
    for (let i = 0; i < 650; i++) {
      const x = random() * 512;
      const y = random() * 512;
      stroke(x, y, x + (random() - 0.5) * 9, y + (random() - 0.5) * 3, -55, 0.5, 0.15);
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = tint(-28, 0.07);
      ctx.beginPath();
      ctx.ellipse(
        random() * 512,
        random() * 512,
        18 + random() * 30,
        8 + random() * 20,
        random() * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
