import * as THREE from 'three';

function makeTexture(draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Swoop Racing needs a 2D canvas.');
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createIndustrialSurfaces() {
  const alloy = makeTexture(ctx => {
    ctx.fillStyle = '#5c6568'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = col * 64, y = row * 64;
      ctx.fillStyle = (row + col) % 3 ? '#5b666c' : '#687177';
      ctx.fillRect(x + 2, y + 2, 60, 60);
      ctx.strokeStyle = '#26333a'; ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, 60, 60);
      ctx.strokeStyle = '#8d9697'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 7, y + 7, 50, 50);
      for (const dx of [11, 52]) for (const dy of [11, 52]) {
        ctx.fillStyle = '#202a30'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a9aaa1'; ctx.fillRect(x + dx - 1, y + dy - 1, 2, 2);
      }
    }
    for (let i = 0; i < 450; i++) {
      const x = (i * 113.37) % 256, y = (i * 79.91) % 256;
      ctx.fillStyle = i % 3 ? '#303c42' : '#a5acaa';
      ctx.globalAlpha = .1 + (i % 7) * .012;
      ctx.fillRect(x, y, 1 + i % 13, .6);
    }
    ctx.globalAlpha = 1;
  });
  const warning = makeTexture(ctx => {
    ctx.fillStyle = '#20282b'; ctx.fillRect(0, 0, 256, 256);
    ctx.save(); ctx.translate(-256, 0); ctx.rotate(-Math.PI / 4);
    for (let x = -256; x < 700; x += 52) {
      ctx.fillStyle = '#d9a842'; ctx.fillRect(x, -512, 26, 1024);
      ctx.fillStyle = '#f4c96b'; ctx.fillRect(x + 3, -512, 2, 1024);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(19,26,30,.12)';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 53) % 256, (i * 97) % 256, 25, 2);
  });
  const paint = makeTexture(ctx => {
    ctx.fillStyle = '#b56339'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      ctx.fillStyle = y % 128 ? '#9c4f32' : '#bd7044';
      ctx.fillRect(0, y + 2, 256, 60);
      ctx.fillStyle = '#472f2a'; ctx.fillRect(0, y + 1, 256, 2);
      ctx.fillStyle = '#e3aa71'; ctx.fillRect(0, y + 6, 256, 1);
    }
    for (let i = 0; i < 250; i++) {
      ctx.fillStyle = i % 3 ? '#f2d1a0' : '#2c3940';
      ctx.globalAlpha = .08 + (i % 5) * .02;
      ctx.fillRect((i * 67.33) % 256, (i * 41.77) % 256, 1 + i % 11, .8);
    }
    ctx.globalAlpha = 1;
  });
  return { alloy, warning, paint };
}

export type IndustrialSurfaces = ReturnType<typeof createIndustrialSurfaces>;

export function disposeIndustrialSurfaces(surfaces: IndustrialSurfaces) {
  Object.values(surfaces).forEach(texture => texture.dispose());
}
