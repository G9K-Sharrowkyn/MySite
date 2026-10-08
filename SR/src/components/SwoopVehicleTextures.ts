import * as THREE from 'three';

function canvasTexture(draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Swoop vehicle textures need a 2D canvas.');
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function paintedAlloy(context: CanvasRenderingContext2D, bump = false) {
  const width = 512;
  const base = context.createLinearGradient(0, 0, width, 0);
  if (bump) {
    base.addColorStop(0, '#858585');
    base.addColorStop(.42, '#b7b7b7');
    base.addColorStop(1, '#777777');
  } else {
    base.addColorStop(0, '#76351f');
    base.addColorStop(.25, '#c96836');
    base.addColorStop(.58, '#e89955');
    base.addColorStop(1, '#78391f');
  }
  context.fillStyle = base;
  context.fillRect(0, 0, width, width);

  // Longitudinal stamped panels and dark seams follow the vehicle's tapered UVs.
  for (const y of [60, 148, 258, 363, 449]) {
    context.fillStyle = bump ? '#525252' : '#452b28';
    context.fillRect(0, y, width, 5);
    context.fillStyle = bump ? '#d4d4d4' : '#f3b778';
    context.fillRect(0, y + 6, width, 2);
    for (let x = 18; x < width; x += 66) {
      context.fillStyle = bump ? '#565656' : '#332e30';
      context.beginPath(); context.arc(x, y - 10, 3.2, 0, Math.PI * 2); context.fill();
      context.fillStyle = bump ? '#c4c4c4' : '#d6b181';
      context.beginPath(); context.arc(x - .6, y - 10.6, 1.3, 0, Math.PI * 2); context.fill();
    }
  }

  // A few broad service panels break the repetitive orange surface.
  for (const [x, y, w, h] of [[44, 72, 133, 61], [243, 169, 168, 71], [82, 286, 150, 61], [280, 384, 174, 54]]) {
    context.fillStyle = bump ? '#9a9a9a' : 'rgba(38,47,50,.40)';
    context.fillRect(x, y, w, h);
    context.strokeStyle = bump ? '#d0d0d0' : '#dc9b61';
    context.lineWidth = 3;
    context.strokeRect(x + 4, y + 4, w - 8, h - 8);
  }
  context.fillStyle = bump ? '#a0a0a0' : 'rgba(255,219,158,.25)';
  for (let index = 0; index < 280; index++) {
    const x = (index * 73.37) % width;
    const y = (index * 191.13) % width;
    context.fillRect(x, y, 8 + index % 21, index % 4 ? .7 : 1.5);
  }
}

function armoredAlloy(context: CanvasRenderingContext2D) {
  context.fillStyle = '#26323a';
  context.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    context.fillStyle = y % 64 ? '#2e3d43' : '#35454c';
    context.fillRect(0, y + 2, 512, 27);
    context.fillStyle = '#111b20';
    context.fillRect(0, y + 29, 512, 3);
    context.fillStyle = '#65757a';
    context.fillRect(0, y + 3, 512, 1);
  }
  for (let x = 0; x < 512; x += 64) {
    context.fillStyle = 'rgba(8,14,19,.48)';
    context.fillRect(x + 3, 0, 3, 512);
    for (let y = 17; y < 512; y += 64) {
      context.fillStyle = '#aab1ac';
      context.beginPath(); context.arc(x + 16, y, 2.2, 0, Math.PI * 2); context.fill();
    }
  }
}

export function createSwoopVehicleTextures() {
  const paint = canvasTexture(context => paintedAlloy(context));
  const paintBump = canvasTexture(context => paintedAlloy(context, true));
  paintBump.colorSpace = THREE.NoColorSpace;
  const armor = canvasTexture(armoredAlloy);
  return { paint, paintBump, armor };
}

export type SwoopVehicleTextures = ReturnType<typeof createSwoopVehicleTextures>;

export function disposeSwoopVehicleTextures(textures: SwoopVehicleTextures) {
  Object.values(textures).forEach(texture => texture.dispose());
}
