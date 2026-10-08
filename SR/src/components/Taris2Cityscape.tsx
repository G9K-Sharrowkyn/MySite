import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Taris2Textures } from './Taris2Textures';

const LENGTH = 40;
const SEGMENTS = 7;
const LAYERS = [
  { count: 13, minX: 25, maxX: 46, minWidth: 3.3, maxWidth: 8, minHeight: 27, maxHeight: 63 },
  { count: 15, minX: 46, maxX: 76, minWidth: 5, maxWidth: 13, minHeight: 37, maxHeight: 92 },
  { count: 18, minX: 76, maxX: 150, minWidth: 8, maxWidth: 20, minHeight: 61, maxHeight: 130 },
] as const;
const MAX_BUILDINGS = 2 * LAYERS.reduce((sum, layer) => sum + layer.count, 0);
const STYLE_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 2, 4, 6, 8, 1, 3, 5, 7, 9, 10, 11, 12, 13] as const;

function randomFor(section: number, index: number, salt: number) {
  let value = Math.imul(section + 149, 1597334677) ^ Math.imul(index + 71, 3812015801) ^ salt;
  value = Math.imul(value ^ value >>> 16, 2246822507);
  value = Math.imul(value ^ value >>> 13, 3266489909);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

function touch(mesh: THREE.InstancedMesh | null) {
  if (!mesh) return;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// One copy of each geometry is instanced across a changing 40-metre world block.
// The model mix, lit windows and placement are seeded by the actual race section.
export function Taris2Cityscape({ index, distanceRef, textures, buildingModels, plazaModels }: {
  index: number;
  distanceRef: React.MutableRefObject<number>;
  textures: Taris2Textures;
  buildingModels: THREE.BufferGeometry[];
  plazaModels: THREE.BufferGeometry[];
}) {
  const buildings = useRef<(THREE.InstancedMesh | null)[]>([]);
  const plazas = useRef<(THREE.InstancedMesh | null)[]>([]);
  const supports = useRef<THREE.InstancedMesh>(null);
  const connectors = useRef<THREE.InstancedMesh>(null);
  const skybridges = useRef<THREE.InstancedMesh>(null);
  const bridgeRails = useRef<THREE.InstancedMesh>(null);
  const plazaRings = useRef<THREE.InstancedMesh>(null);
  const sections = useRef(-1);

  const update = (section: number) => {
    if (sections.current === section || buildings.current.length !== buildingModels.length || buildings.current.some(mesh => !mesh)
      || plazas.current.length !== plazaModels.length || plazas.current.some(mesh => !mesh)
      || !supports.current || !connectors.current || !skybridges.current || !bridgeRails.current || !plazaRings.current) return;
    sections.current = section;
    const object = new THREE.Object3D();
    const counts = buildingModels.map(() => 0);
    const plazaCounts = plazaModels.map(() => 0);
    let supportCount = 0;

    for (const [sideIndex, side] of ([-1, 1] as const).entries()) {
      const plazaX = side * (17 + randomFor(section, sideIndex, 151) * 2);
      const plazaZ = (randomFor(section, sideIndex, 162) - .5) * 15;
      const plazaStyle = ((section + sideIndex) % 3 + 3) % 3;
      object.rotation.set(0, 0, 0);
      object.position.set(plazaX, 1.58, plazaZ);
      object.scale.set(19, 1, 18);
      object.updateMatrix();
      plazas.current[plazaStyle]?.setMatrixAt(plazaCounts[plazaStyle]++, object.matrix);

      object.position.set(plazaX, 1.79, plazaZ);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.set(17.3, 16.4, 1);
      object.updateMatrix();
      plazaRings.current.setMatrixAt(sideIndex, object.matrix);

      object.rotation.set(0, 0, 0);
      object.position.set(side * 5.65, 1.52, plazaZ);
      object.scale.set(5.2, .22, 4.2);
      object.updateMatrix();
      connectors.current.setMatrixAt(sideIndex, object.matrix);

      object.position.set(side * 38, 1.35, plazaZ + 2.5);
      object.scale.set(25, .42, 4.4);
      object.updateMatrix();
      skybridges.current.setMatrixAt(sideIndex, object.matrix);
      for (const [railIndex, dz] of [-2.1, 2.1].entries()) {
        object.position.set(side * 38, 1.7, plazaZ + 2.5 + dz);
        object.scale.set(25, .075, .10);
        object.updateMatrix();
        bridgeRails.current.setMatrixAt(sideIndex * 2 + railIndex, object.matrix);
      }

      for (const dx of [-7, 7]) for (const dz of [-6.5, 6.5]) {
        object.position.set(plazaX + dx, -7.95, plazaZ + dz);
        object.scale.set(.72, 19.3, .72);
        object.updateMatrix();
        supports.current.setMatrixAt(supportCount++, object.matrix);
      }

      let layerOffset = 0;
      for (const [layerIndex, layer] of LAYERS.entries()) {
        for (let slot = 0; slot < layer.count; slot++) {
          const serial = sideIndex * (MAX_BUILDINGS / 2) + layerOffset + slot;
          const z = -LENGTH / 2 + (slot + .5) * LENGTH / layer.count
            + (randomFor(section, serial, 31) - .5) * (LENGTH / layer.count) * .65;
          const xDistance = layer.minX + randomFor(section, serial, 47) * (layer.maxX - layer.minX);
          if (layerIndex === 0 && xDistance < 39 && Math.abs(z - plazaZ) < 9.5) continue;
          const style = STYLE_SEQUENCE[(serial + section * 5) % STYLE_SEQUENCE.length];
          const width = layer.minWidth + randomFor(section, serial, 53) * (layer.maxWidth - layer.minWidth);
          const height = layer.minHeight + randomFor(section, serial, 64) * (layer.maxHeight - layer.minHeight);
          const depth = width * (.75 + randomFor(section, serial, 75) * .6);
          object.position.set(side * xDistance, -17.45, z);
          object.rotation.set(0, (randomFor(section, serial, 86) - .5) * .32, 0);
          object.scale.set(width, height, depth);
          object.updateMatrix();
          const mesh = buildings.current[style];
          mesh?.setMatrixAt(counts[style], object.matrix);
          mesh?.setColorAt(counts[style], new THREE.Color().setHSL(
            .53 + randomFor(section, serial, 97) * .06,
            .08 + randomFor(section, serial, 108) * .12,
            .68 + randomFor(section, serial, 119) * .28,
          ));
          counts[style]++;
        }
        layerOffset += layer.count;
      }
    }

    buildings.current.forEach((mesh, type) => { if (mesh) { mesh.count = counts[type]; touch(mesh); } });
    plazas.current.forEach((mesh, type) => { if (mesh) { mesh.count = plazaCounts[type]; touch(mesh); } });
    supports.current.count = supportCount;
    touch(supports.current);
    touch(connectors.current);
    touch(skybridges.current);
    touch(bridgeRails.current);
    touch(plazaRings.current);
  };

  useLayoutEffect(() => update(index));
  useFrame(() => {
    const section = index + SEGMENTS * Math.floor((distanceRef.current - index * LENGTH + (SEGMENTS - 1) * LENGTH) / (SEGMENTS * LENGTH));
    update(section);
  });

  return <group>
    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[side * 78, -18, 0]}>
        <boxGeometry args={[148, 1.1, LENGTH]} />
        <meshStandardMaterial color="#2b3a42" metalness={.36} roughness={.77} />
      </mesh>
      {[{ x: 51, y: 3.3, width: 4.5 }, { x: 95, y: 12, width: 6 }].map(avenue => <group key={avenue.x}>
        <mesh position={[side * avenue.x, avenue.y, 0]}>
          <boxGeometry args={[avenue.width, .48, LENGTH]} />
          <meshStandardMaterial map={textures.metal} color="#c4d0d0" metalness={.63} roughness={.55} />
        </mesh>
        <mesh position={[side * avenue.x, avenue.y + .29, 0]}>
          <boxGeometry args={[avenue.width - .4, .055, LENGTH]} />
          <meshBasicMaterial color="#7caeb6" />
        </mesh>
      </group>)}
    </group>)}

    {buildingModels.map((geometry, type) => <instancedMesh key={type} ref={node => { buildings.current[type] = node; }} args={[undefined, undefined, MAX_BUILDINGS]} frustumCulled={false}>
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial map={textures.facades[type % textures.facades.length]} color="#ffffff" metalness={.38} roughness={.75} />
    </instancedMesh>)}
    {plazaModels.map((geometry, type) => <instancedMesh key={type} ref={node => { plazas.current[type] = node; }} args={[undefined, undefined, 2]} frustumCulled={false}>
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial map={textures.metal} color="#c9d7d4" metalness={.56} roughness={.62} />
    </instancedMesh>)}
    <instancedMesh ref={supports} args={[undefined, undefined, 8]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.metal} color="#8d9ba0" metalness={.59} roughness={.64} />
    </instancedMesh>
    <instancedMesh ref={connectors} args={[undefined, undefined, 2]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.metal} color="#c4d2cf" metalness={.53} roughness={.58} />
    </instancedMesh>
    <instancedMesh ref={skybridges} args={[undefined, undefined, 2]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.metal} color="#c2cdd1" metalness={.53} roughness={.62} />
    </instancedMesh>
    <instancedMesh ref={bridgeRails} args={[undefined, undefined, 4]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#8acbcc" toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={plazaRings} args={[undefined, undefined, 2]} frustumCulled={false}>
      <torusGeometry args={[.5, .008, 4, 48]} />
      <meshBasicMaterial color="#70c7cc" toneMapped={false} />
    </instancedMesh>
  </group>;
}
