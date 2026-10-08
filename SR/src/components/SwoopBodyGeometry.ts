import * as THREE from 'three';

export interface HullSection {
  z: number;
  width: number;
  top: number;
  bottom: number;
}

// A tapered, six-sided shell gives the swoop actual panel surfaces instead of
// intersecting stretched spheres and boxes. The UV runs along its nose-to-tail axis.
export function createSwoopHullGeometry(sections: HullSection[]) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const firstZ = sections[0].z;
  const span = sections[sections.length - 1].z - firstZ;
  for (const section of sections) {
    const mid = (section.top + section.bottom) / 2;
    const ring = [
      [-section.width * .67, section.top],
      [section.width * .67, section.top],
      [section.width, mid],
      [section.width * .7, section.bottom],
      [-section.width * .7, section.bottom],
      [-section.width, mid],
    ];
    for (const [index, [x, y]] of ring.entries()) {
      positions.push(x, y, section.z);
      uvs.push((section.z - firstZ) / span, index / 6);
    }
  }
  for (let section = 0; section < sections.length - 1; section++) for (let edge = 0; edge < 6; edge++) {
    const a = section * 6 + edge;
    const b = (section + 1) * 6 + edge;
    const c = section * 6 + (edge + 1) % 6;
    const d = (section + 1) * 6 + (edge + 1) % 6;
    indices.push(a, b, c, b, d, c);
  }
  for (let edge = 1; edge < 5; edge++) {
    indices.push(0, edge, edge + 1);
    const last = (sections.length - 1) * 6;
    indices.push(last, last + edge + 1, last + edge);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createSwoopTopPanelGeometry(sections: HullSection[]) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const firstZ = sections[0].z;
  const span = sections[sections.length - 1].z - firstZ;
  for (const section of sections) {
    positions.push(-section.width * .53, section.top + .009, section.z);
    positions.push(section.width * .53, section.top + .009, section.z);
    const u = (section.z - firstZ) / span;
    uvs.push(u, 0, u, 1);
  }
  for (let section = 0; section < sections.length - 1; section++) {
    const a = section * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
