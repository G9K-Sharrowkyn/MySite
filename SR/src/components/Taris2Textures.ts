import * as THREE from 'three';

export interface Taris2Textures {
  road: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  sign: THREE.CanvasTexture;
  facades: THREE.CanvasTexture[];
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function canvasTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

function plateCanvas(base: string, seam: string, seed: number, relief = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Taris 2.0 needs a 2D canvas.');
  const random = seeded(seed);

  ctx.fillStyle = relief ? '#8b8b8b' : base;
  ctx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 128 + (row % 2 ? -32 : 0);
      const y = row * 128;
      ctx.fillStyle = relief ? '#969696' : (row + col) % 3 === 0 ? '#38454c' : base;
      ctx.fillRect(x + 3, y + 3, 122, 122);
      ctx.strokeStyle = relief ? '#393939' : seam;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, 124, 124);
      ctx.strokeStyle = relief ? '#adadad' : '#59666c';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, y + 8, 112, 112);
      for (const dx of [15, 111]) for (const dy of [15, 111]) {
        ctx.fillStyle = relief ? '#2e2e2e' : '#121d24';
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = relief ? '#cccccc' : '#8d9899';
        ctx.fillRect(x + dx - 1, y + dy - 1, 2, 2);
      }
    }
  }

  for (let index = 0; index < 2500; index++) {
    const x = random() * 512;
    const y = random() * 512;
    const length = 1 + random() * 19;
    ctx.strokeStyle = relief
      ? `rgba(30,30,30,${0.04 + random() * 0.12})`
      : random() > 0.55 ? `rgba(178,190,185,${0.025 + random() * 0.09})` : `rgba(4,12,16,${0.035 + random() * 0.12})`;
    ctx.lineWidth = random() > .94 ? 1.6 : .55;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + (random() - .5) * 2); ctx.stroke();
  }
  return canvas;
}

function signCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Taris 2.0 needs a 2D canvas.');
  ctx.fillStyle = '#102127';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#d09350';
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 122, 512, 6);
  ctx.font = 'bold 41px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d7ecea';
  ctx.fillText('TARIS  //  LOWER CITY', 256, 71);
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillStyle = '#7cabb3';
  ctx.fillText('TRANSIT CORRIDOR  07', 256, 101);
  return canvas;
}

function facadeCanvas(seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Taris 2.0 needs a 2D canvas.');
  const random = seeded(seed);
  ctx.fillStyle = seed % 2 ? '#25343d' : '#37434a';
  ctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 20; row++) for (let col = 0; col < 8; col++) {
    const x = col * 32;
    const y = row * 25.6;
    ctx.fillStyle = row % (seed % 2 ? 4 : 6) === 0 ? '#73858b' : '#52616a';
    ctx.fillRect(x, y, 30, 1);
    ctx.fillStyle = '#161f27';
    ctx.fillRect(x + 5, y + 5, 22, 15);
    const lit = random() > (seed % 3 === 0 ? .65 : .47);
    ctx.fillStyle = lit ? (random() > .75 ? '#69aeb4' : '#b68f5d') : '#1b2b33';
    ctx.globalAlpha = lit ? .75 + random() * .25 : 1;
    ctx.fillRect(x + 7, y + 7, 18, 11);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#809097';
    ctx.fillRect(x + 15, y + 7, 1, 11);
  }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(180,194,194,${random() * .08})`;
    ctx.fillRect(random() * 256, random() * 512, 1, 3 + random() * 25);
  }
  return canvas;
}


export function createTaris2Textures(): Taris2Textures {
  return {
    road: canvasTexture(plateCanvas('#465257', '#18242b', 784), 1, 8),
    roadBump: canvasTexture(plateCanvas('#888888', '#333333', 784, true), 1, 8, false),
    metal: canvasTexture(plateCanvas('#4e5e68', '#192a31', 321), 1, 3),
    metalBump: canvasTexture(plateCanvas('#888888', '#333333', 321, true), 1, 3, false),
    sign: canvasTexture(signCanvas()),
    facades: [9312, 217].map(seed => canvasTexture(facadeCanvas(seed))),
  };
}

export function disposeTaris2Textures(textures: Taris2Textures) {
  Object.values(textures).flat().forEach(texture => texture.dispose());
}
