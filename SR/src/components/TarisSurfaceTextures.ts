import * as THREE from 'three';

export interface TarisSurfaceTextures {
  floor: THREE.CanvasTexture;
  wall: THREE.CanvasTexture;
  ceiling: THREE.CanvasTexture;
  skyline: THREE.CanvasTexture;
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D) => void, width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Taris textures require a 2D canvas.');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function panelGrid(ctx: CanvasRenderingContext2D, base: string, seam: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.lineWidth = 2;
  ctx.strokeStyle = seam;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(256, y + .5); ctx.stroke();
  }
  for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = '#687882';
    ctx.fillRect(x + 6, y + 6, 2, 2);
    ctx.fillRect(x + 55, y + 55, 2, 2);
  }
}

export function createTarisSurfaceTextures(): TarisSurfaceTextures {
  const floor = makeTexture(ctx => {
    panelGrid(ctx, '#454e53', '#202a31');
    ctx.fillStyle = '#566166';
    for (let x = 0; x < 256; x += 16) {
      for (let y = 0; y < 256; y += 16) {
        if ((x + y) % 48 === 0) ctx.fillRect(x + 2, y + 2, 10, 1);
      }
    }
    ctx.strokeStyle = '#687377';
    ctx.lineWidth = 1;
    for (let y = 32; y < 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
  });
  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.repeat.set(1, 5);

  const wall = makeTexture(ctx => {
    panelGrid(ctx, '#424e59', '#192730');
    ctx.fillStyle = '#22343d';
    for (let x = 8; x < 256; x += 64) {
      ctx.fillRect(x, 17, 47, 20);
      ctx.fillRect(x, 156, 47, 19);
      ctx.fillStyle = '#71838a';
      for (let line = 0; line < 4; line++) {
        ctx.fillRect(x + 4, 20 + line * 4, 39, 1);
        ctx.fillRect(x + 4, 159 + line * 4, 39, 1);
      }
      ctx.fillStyle = '#22343d';
    }
    ctx.fillStyle = '#996642';
    ctx.fillRect(0, 90, 256, 4);
    ctx.fillRect(0, 210, 256, 2);
  });
  wall.wrapS = wall.wrapT = THREE.RepeatWrapping;
  wall.repeat.set(5, 1);

  const ceiling = makeTexture(ctx => {
    panelGrid(ctx, '#333f47', '#17232a');
    ctx.fillStyle = '#172930';
    for (let y = 8; y < 256; y += 64) {
      ctx.fillRect(42, y, 172, 17);
      ctx.fillStyle = '#69777e';
      for (let x = 48; x < 212; x += 10) ctx.fillRect(x, y + 4, 5, 1);
      ctx.fillStyle = '#172930';
    }
  });
  ceiling.wrapS = ceiling.wrapT = THREE.RepeatWrapping;
  ceiling.repeat.set(1, 5);

  const skyline = makeTexture(ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#162c42');
    gradient.addColorStop(.55, '#2e5262');
    gradient.addColorStop(1, '#0c1a23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#536f7b';
    ctx.fillRect(0, 32, 256, 2);
    ctx.fillStyle = '#0b1820';
    for (let i = 0; i < 18; i++) {
      const x = i * 16 - 3;
      const height = 36 + ((i * 19 + 7) % 58);
      ctx.fillRect(x, 128 - height, 13 + (i % 3) * 4, height);
      ctx.fillStyle = i % 3 === 0 ? '#62cad5' : '#dfa367';
      for (let y = 128 - height + 8; y < 116; y += 12) {
        ctx.fillRect(x + 4, y, 2, 3);
        ctx.fillRect(x + 10, y, 2, 3);
      }
      ctx.fillStyle = '#0b1820';
    }
    ctx.fillStyle = '#b4c8bd';
    ctx.fillRect(0, 106, 256, 1);
  }, 256, 128);

  return { floor, wall, ceiling, skyline };
}

export function disposeTarisSurfaceTextures(textures: TarisSurfaceTextures) {
  Object.values(textures).forEach(texture => texture.dispose());
}
