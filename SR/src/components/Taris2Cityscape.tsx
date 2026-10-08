import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { getTaris2PlazaPlan, taris2Random, TARIS2_SECTION_LENGTH } from '../game/taris2Layout';
import type { Taris2Textures } from './Taris2Textures';

const LAYERS = [
  { count: 13, minX: 25, maxX: 46, minWidth: 3.3, maxWidth: 8, minHeight: 27, maxHeight: 63 },
  { count: 15, minX: 46, maxX: 76, minWidth: 5, maxWidth: 13, minHeight: 37, maxHeight: 92 },
  { count: 18, minX: 76, maxX: 150, minWidth: 8, maxWidth: 20, minHeight: 61, maxHeight: 130 },
] as const;
const MAX_BUILDINGS_PER_SECTION = 2 * LAYERS.reduce((sum, layer) => sum + layer.count, 0);
const STYLE_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 2, 4, 6, 8, 1, 3, 5, 7, 9, 10, 11, 12, 13] as const;

function touch(mesh: THREE.InstancedMesh | null) {
  if (!mesh) return;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

// The complete city is assembled once. Each model is one geometry, repeated by
// GPU instancing along the whole course instead of recycling blocks in front
// of the camera. The enclosing environment group travels with race distance.
export function Taris2Cityscape({ sectionStart, sectionCount, textures, buildingModels, plazaModels }: {
  sectionStart: number;
  sectionCount: number;
  textures: Taris2Textures;
  buildingModels: THREE.BufferGeometry[];
  plazaModels: THREE.BufferGeometry[];
}) {
  const buildings = useRef<(THREE.InstancedMesh | null)[]>([]);
  const plazas = useRef<(THREE.InstancedMesh | null)[]>([]);
  const supports = useRef<THREE.InstancedMesh>(null);
  const skybridges = useRef<THREE.InstancedMesh>(null);
  const bridgeRails = useRef<THREE.InstancedMesh>(null);
  const plazaRings = useRef<THREE.InstancedMesh>(null);
  const plazaCapacity = sectionCount * 2;
  const fullLength = sectionCount * TARIS2_SECTION_LENGTH;
  const centerZ = -(sectionCount - 1) * TARIS2_SECTION_LENGTH / 2;

  useLayoutEffect(() => {
    if (buildings.current.length !== buildingModels.length || buildings.current.some(mesh => !mesh)
      || plazas.current.length !== plazaModels.length || plazas.current.some(mesh => !mesh)
      || !supports.current || !skybridges.current || !bridgeRails.current || !plazaRings.current) return;

    const object = new THREE.Object3D();
    const tint = new THREE.Color();
    const counts = buildingModels.map(() => 0);
    const plazaCounts = plazaModels.map(() => 0);
    let supportCount = 0;
    let bridgeCount = 0;
    let ringCount = 0;

    for (let localSection = 0; localSection < sectionCount; localSection++) {
      const section = sectionStart + localSection;
      const sectionZ = -localSection * TARIS2_SECTION_LENGTH;
      for (const [sideIndex, side] of ([-1, 1] as const).entries()) {
        const plaza = getTaris2PlazaPlan(section, sideIndex);
        if (plaza) {
          const x = side * plaza.xDistance;
          const z = sectionZ + plaza.z;
          object.rotation.set(0, 0, 0);
          object.position.set(x, plaza.height, z);
          object.scale.set(plaza.scaleX, 1, plaza.scaleZ);
          object.updateMatrix();
          plazas.current[plaza.style]?.setMatrixAt(plazaCounts[plaza.style]++, object.matrix);

          object.rotation.set(-Math.PI / 2, 0, 0);
          object.position.set(x, plaza.height + .18, z);
          object.scale.set(plaza.scaleX * 1.03, plaza.scaleZ * 1.03, 1);
          object.updateMatrix();
          plazaRings.current.setMatrixAt(ringCount++, object.matrix);

          object.rotation.set(0, 0, 0);
          const supportHeight = plaza.height + 17.45;
          for (const dx of [-.35, .35]) for (const dz of [-.35, .35]) {
            object.position.set(x + dx * plaza.scaleX, -17.45 + supportHeight / 2, z + dz * plaza.scaleZ);
            object.scale.set(.75, supportHeight, .75);
            object.updateMatrix();
            supports.current.setMatrixAt(supportCount++, object.matrix);
          }

          // Walkways connect city structures, never the race corridor.
          const from = plaza.xDistance + plaza.scaleX * .55;
          const to = plaza.avenueX;
          if (Math.abs(plaza.height - plaza.avenueY) <= 8 && to > from + 2) {
            const span = to - from;
            const slope = Math.atan2(plaza.avenueY - plaza.height, side * span);
            object.rotation.set(0, 0, slope);
            object.position.set(side * (from + to) / 2, (plaza.height + plaza.avenueY) / 2, z + 2);
            object.scale.set(span, .36, 4.2);
            object.updateMatrix();
            skybridges.current.setMatrixAt(bridgeCount, object.matrix);
            for (const [railIndex, offsetZ] of [-1.95, 1.95].entries()) {
              object.position.set(side * (from + to) / 2, (plaza.height + plaza.avenueY) / 2 + .42, z + 2 + offsetZ);
              object.scale.set(span, .08, .1);
              object.updateMatrix();
              bridgeRails.current.setMatrixAt(bridgeCount * 2 + railIndex, object.matrix);
            }
            bridgeCount++;
          }
        }

        let layerOffset = 0;
        for (const [layerIndex, layer] of LAYERS.entries()) {
          for (let slot = 0; slot < layer.count; slot++) {
            const serial = sideIndex * (MAX_BUILDINGS_PER_SECTION / 2) + layerOffset + slot;
            const localZ = -TARIS2_SECTION_LENGTH / 2 + (slot + .5) * TARIS2_SECTION_LENGTH / layer.count
              + (taris2Random(section, serial, 31) - .5) * (TARIS2_SECTION_LENGTH / layer.count) * .65;
            const xDistance = layer.minX + taris2Random(section, serial, 47) * (layer.maxX - layer.minX);
            const width = layer.minWidth + taris2Random(section, serial, 53) * (layer.maxWidth - layer.minWidth);
            const height = layer.minHeight + taris2Random(section, serial, 64) * (layer.maxHeight - layer.minHeight);
            const depth = width * (.75 + taris2Random(section, serial, 75) * .6);
            // Occasional open sightlines make terraces deep in the city visible
            // without thinning every block of the dense skyline.
            if (plaza && plaza.xDistance >= 68 && section % 4 === 0
              && layerIndex < (plaza.xDistance >= 100 ? 2 : 1)
              && Math.abs(localZ - plaza.z) < depth / 2 + 5) continue;
            if (plaza && Math.abs(xDistance - plaza.xDistance) < plaza.scaleX * .61 + width / 2 + 1.2
              && Math.abs(localZ - plaza.z) < plaza.scaleZ * .55 + depth / 2 + 1.2) continue;
            const style = STYLE_SEQUENCE[(serial + section * 5) % STYLE_SEQUENCE.length];
            object.position.set(side * xDistance, -17.45, sectionZ + localZ);
            object.rotation.set(0, (taris2Random(section, serial, 86) - .5) * .32, 0);
            object.scale.set(width, height, depth);
            object.updateMatrix();
            const mesh = buildings.current[style];
            mesh?.setMatrixAt(counts[style], object.matrix);
            tint.setHSL(
              .53 + taris2Random(section, serial, 97) * .06,
              .08 + taris2Random(section, serial, 108) * .12,
              .68 + taris2Random(section, serial, 119) * .28,
            );
            mesh?.setColorAt(counts[style], tint);
            counts[style]++;
          }
          layerOffset += layer.count;
        }
      }
    }

    buildings.current.forEach((mesh, type) => { if (mesh) { mesh.count = counts[type]; touch(mesh); } });
    plazas.current.forEach((mesh, type) => { if (mesh) { mesh.count = plazaCounts[type]; touch(mesh); } });
    supports.current.count = supportCount;
    skybridges.current.count = bridgeCount;
    bridgeRails.current.count = bridgeCount * 2;
    plazaRings.current.count = ringCount;
    touch(supports.current);
    touch(skybridges.current);
    touch(bridgeRails.current);
    touch(plazaRings.current);
  }, [sectionStart, sectionCount, buildingModels, plazaModels]);

  return <group>
    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[side * 78, -18, centerZ]}>
        <boxGeometry args={[148, 1.1, fullLength]} />
        <meshStandardMaterial color="#2b3a42" metalness={.36} roughness={.77} />
      </mesh>
      {[{ x: 51, y: 3.3, width: 4.5 }, { x: 72, y: 9, width: 4 }, { x: 95, y: 12, width: 6 }, { x: 130, y: 19, width: 5 }].map(avenue => <group key={avenue.x}>
        <mesh position={[side * avenue.x, avenue.y, centerZ]}>
          <boxGeometry args={[avenue.width, .48, fullLength]} />
          <meshStandardMaterial map={textures.metal} color="#c4d0d0" metalness={.63} roughness={.55} />
        </mesh>
        <mesh position={[side * avenue.x, avenue.y + .29, centerZ]}>
          <boxGeometry args={[avenue.width - .4, .055, fullLength]} />
          <meshBasicMaterial color="#7caeb6" />
        </mesh>
      </group>)}
    </group>)}

    {buildingModels.map((geometry, type) => <instancedMesh key={type} ref={node => { buildings.current[type] = node; }} args={[undefined, undefined, sectionCount * MAX_BUILDINGS_PER_SECTION]}>
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial map={textures.facades[type % textures.facades.length]} color="#ffffff" metalness={.38} roughness={.75} />
    </instancedMesh>)}
    {plazaModels.map((geometry, type) => <instancedMesh key={type} ref={node => { plazas.current[type] = node; }} args={[undefined, undefined, plazaCapacity]}>
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial map={textures.metal} color="#c9d7d4" metalness={.56} roughness={.62} />
    </instancedMesh>)}
    <instancedMesh ref={supports} args={[undefined, undefined, plazaCapacity * 4]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.metal} color="#8d9ba0" metalness={.59} roughness={.64} />
    </instancedMesh>
    <instancedMesh ref={skybridges} args={[undefined, undefined, plazaCapacity]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.metal} color="#c2cdd1" metalness={.53} roughness={.62} />
    </instancedMesh>
    <instancedMesh ref={bridgeRails} args={[undefined, undefined, plazaCapacity * 2]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#8acbcc" toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={plazaRings} args={[undefined, undefined, plazaCapacity]}>
      <torusGeometry args={[.5, .008, 4, 48]} />
      <meshBasicMaterial color="#70c7cc" toneMapped={false} />
    </instancedMesh>
  </group>;
}
