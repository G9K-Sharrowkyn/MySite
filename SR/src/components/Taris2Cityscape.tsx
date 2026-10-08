import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Taris2Textures } from './Taris2Textures';

const LENGTH = 40;
const SEGMENTS = 7;
const COUNT = 8;
const VARIANTS = 2;

function randomFor(section: number, index: number, salt: number) {
  let value = Math.imul(section + 149, 1597334677) ^ Math.imul(index + 71, 3812015801) ^ salt;
  value = Math.imul(value ^ value >>> 16, 2246822507);
  value = Math.imul(value ^ value >>> 13, 3266489909);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

// The towers are positioned in world sections. Recycled corridor geometry gets
// fresh architecture as the player advances, so the skyline never loops.
export function Taris2Cityscape({ index, distanceRef, textures }: {
  index: number;
  distanceRef: React.MutableRefObject<number>;
  textures: Taris2Textures;
}) {
  const bodies = useRef<(THREE.InstancedMesh | null)[]>([]);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const sections = useRef(-1);

  const update = (section: number) => {
    if (bodies.current.some(mesh => !mesh) || bodies.current.length !== VARIANTS || !crowns.current || !caps.current || sections.current === section) return;
    sections.current = section;
    const object = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const side = i < COUNT / 2 ? -1 : 1;
      const slot = i % (COUNT / 2);
      const distance = 12 + randomFor(section, i, 21) * 43;
      const x = side * distance;
      const z = -15 + slot * 10 + (randomFor(section, i, 32) - .5) * 3;
      const near = distance < 25;
      const height = (near ? 12 : 21) + randomFor(section, i, 43) * (near ? 22 : 45);
      const width = 3.2 + randomFor(section, i, 54) * (near ? 4.8 : 7.8);
      const depth = 2.5 + randomFor(section, i, 65) * 5.5;
      const setback = randomFor(section, i, 122) > .31;
      const lowerHeight = setback ? height * (.64 + randomFor(section, i, 133) * .13) : height;
      object.rotation.set(0, 0, 0);
      // Foundations disappear below the sill without filling the whole skyline.
      object.position.set(x, (lowerHeight - 2 - 14) / 2, z);
      object.scale.set(width, lowerHeight + 12, depth);
      object.updateMatrix();
      const body = bodies.current[i % VARIANTS];
      body?.setMatrixAt(Math.floor(i / VARIANTS), object.matrix);
      body?.setColorAt(Math.floor(i / VARIANTS), new THREE.Color().setHSL(.54 + randomFor(section, i, 76) * .04, .11, .65 + randomFor(section, i, 87) * .25));

      object.position.set(x + width * .08, (lowerHeight + height) / 2 - 2, z + depth * .06);
      object.scale.set(setback ? width * .68 : .001, setback ? height - lowerHeight : .001, setback ? depth * .72 : .001);
      object.updateMatrix();
      crowns.current.setMatrixAt(i, object.matrix);

      object.position.set(x, height - 1.65, z);
      object.scale.set(width * 1.08, .5 + randomFor(section, i, 98) * 1.1, depth * 1.08);
      object.updateMatrix();
      caps.current.setMatrixAt(i, object.matrix);
      caps.current.setColorAt(i, new THREE.Color(i % 4 === 0 ? '#68757b' : '#26343b'));

    }
    for (const mesh of [...bodies.current, crowns.current, caps.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  useLayoutEffect(() => update(index));
  useFrame(() => {
    // Matches the corridor's wrap point: section 0 recycles after 40 metres.
    const section = index + SEGMENTS * Math.floor((distanceRef.current - index * LENGTH + (SEGMENTS - 1) * LENGTH) / (SEGMENTS * LENGTH));
    update(section);
  });

  return <group>
    {textures.facades.map((facade, variant) => <instancedMesh key={variant} ref={node => { bodies.current[variant] = node; }} args={[undefined, undefined, COUNT / VARIANTS]} frustumCulled={false}>
      {variant === 1 ? <cylinderGeometry args={[.5, .5, 1, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial map={facade} color="#ffffff" metalness={.38} roughness={.8} />
    </instancedMesh>)}
    <instancedMesh ref={crowns} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={textures.facades[1]} metalness={.44} roughness={.77} />
    </instancedMesh>
    <instancedMesh ref={caps} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={.55} roughness={.65} />
    </instancedMesh>
  </group>;
}
