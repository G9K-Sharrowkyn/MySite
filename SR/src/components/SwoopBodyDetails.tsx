import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createSwoopHullGeometry, createSwoopTopPanelGeometry } from './SwoopBodyGeometry';
import type { HullSection } from './SwoopBodyGeometry';
import { createSwoopVehicleTextures, disposeSwoopVehicleTextures } from './SwoopVehicleTextures';
import type { SwoopVehicleTextures } from './SwoopVehicleTextures';

const SPINE: HullSection[] = [
  { z: -1.35, width: .035, top: .015, bottom: -.055 },
  { z: -1.13, width: .15, top: .125, bottom: -.12 },
  { z: -.77, width: .25, top: .24, bottom: -.18 },
  { z: -.2, width: .31, top: .23, bottom: -.2 },
  { z: .4, width: .32, top: .18, bottom: -.21 },
  { z: .91, width: .21, top: .08, bottom: -.15 },
];
const NACELLE: HullSection[] = [
  { z: -1.15, width: .055, top: .025, bottom: -.075 },
  { z: -.95, width: .13, top: .16, bottom: -.14 },
  { z: -.58, width: .19, top: .24, bottom: -.18 },
  { z: .05, width: .2, top: .22, bottom: -.2 },
  { z: .56, width: .19, top: .17, bottom: -.2 },
  { z: .76, width: .18, top: .09, bottom: -.18 },
];
const TAIL: HullSection[] = [
  { z: .19, width: .27, top: .23, bottom: .08 },
  { z: .37, width: .46, top: .27, bottom: .07 },
  { z: .63, width: .53, top: .24, bottom: .04 },
  { z: .79, width: .43, top: .13, bottom: -.005 },
];

function SwoopNacelle({ side, textures, shell, deck }: {
  side: -1 | 1;
  textures: SwoopVehicleTextures;
  shell: THREE.BufferGeometry;
  deck: THREE.BufferGeometry;
}) {
  return <group position={[side * .4, 0, 0]}>
    <mesh geometry={shell}>
      <meshPhysicalMaterial map={textures.paint} bumpMap={textures.paintBump} bumpScale={.022}
        metalness={.65} roughness={.35} clearcoat={.48} clearcoatRoughness={.25} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={deck}>
      <meshStandardMaterial map={textures.armor} metalness={.72} roughness={.41} side={THREE.DoubleSide} />
    </mesh>

    {/* Recessed cooling vents and a narrow luminous status strip. */}
    {Array.from({ length: 5 }, (_, index) => <group key={index}>
      <mesh position={[0, .255 - index * .006, -.37 + index * .17]}>
        <boxGeometry args={[.27, .012, .028]} />
        <meshStandardMaterial color="#0c161a" metalness={.62} roughness={.52} />
      </mesh>
      <mesh position={[0, .263 - index * .006, -.382 + index * .17]}>
        <boxGeometry args={[.27, .005, .007]} />
        <meshBasicMaterial color="#8ea9a8" />
      </mesh>
    </group>)}
    <mesh position={[side * .195, .055, -.22]} rotation={[0, side * .07, 0]}>
      <boxGeometry args={[.014, .025, .72]} />
      <meshBasicMaterial color="#81d5d8" toneMapped={false} />
    </mesh>

    {/* Laminated exhaust collar, bolted outer ring and the existing live flame. */}
    <mesh position={[0, 0, .805]}>
      <torusGeometry args={[.19, .023, 10, 32]} />
      <meshStandardMaterial color="#c5c1ae" metalness={.9} roughness={.27} />
    </mesh>
    <mesh position={[0, 0, .832]}>
      <torusGeometry args={[.16, .019, 8, 32]} />
      <meshStandardMaterial color="#1e343c" metalness={.84} roughness={.3} />
    </mesh>
    {Array.from({ length: 8 }, (_, index) => {
      const angle = index * Math.PI / 4;
      return <mesh key={index} position={[Math.sin(angle) * .185, Math.cos(angle) * .185, .837]}>
        <sphereGeometry args={[.012, 8, 6]} />
        <meshStandardMaterial color="#f3cc91" metalness={.7} roughness={.34} />
      </mesh>;
    })}
    <mesh position={[0, -.19, .42]} scale={[.16, .075, .38]}>
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial map={textures.armor} metalness={.76} roughness={.4} />
    </mesh>
    <mesh position={[side * .15, .2, .57]} rotation={[0, 0, -side * .17]}>
      <coneGeometry args={[.085, .31, 3]} />
      <meshStandardMaterial color="#b46b3f" metalness={.66} roughness={.36} flatShading />
    </mesh>
  </group>;
}

// The shell is visual-only; flight physics and collision dimensions stay in Player.
export function SwoopBodyDetails() {
  const textures = useMemo(createSwoopVehicleTextures, []);
  const geometry = useMemo(() => ({
    spine: createSwoopHullGeometry(SPINE),
    spineDeck: createSwoopTopPanelGeometry(SPINE.slice(1, 5)),
    nacelle: createSwoopHullGeometry(NACELLE),
    nacelleDeck: createSwoopTopPanelGeometry(NACELLE.slice(1, 5)),
    tail: createSwoopHullGeometry(TAIL),
    tailDeck: createSwoopTopPanelGeometry(TAIL),
  }), []);
  useEffect(() => () => {
    disposeSwoopVehicleTextures(textures);
    Object.values(geometry).forEach(part => part.dispose());
  }, [textures, geometry]);

  return <group>
    <mesh geometry={geometry.spine}>
      <meshPhysicalMaterial map={textures.paint} bumpMap={textures.paintBump} bumpScale={.02}
        metalness={.65} roughness={.35} clearcoat={.45} clearcoatRoughness={.26} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={geometry.spineDeck}>
      <meshStandardMaterial map={textures.armor} metalness={.7} roughness={.43} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={geometry.tail}>
      <meshPhysicalMaterial map={textures.paint} bumpMap={textures.paintBump} bumpScale={.018}
        metalness={.62} roughness={.34} clearcoat={.5} clearcoatRoughness={.25} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={geometry.tailDeck}>
      <meshStandardMaterial map={textures.armor} metalness={.7} roughness={.38} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, .31, .68]}>
      <boxGeometry args={[1.02, .045, .13]} />
      <meshStandardMaterial color="#c29361" metalness={.79} roughness={.32} />
    </mesh>
    {([-1, 1] as const).map(side => <mesh key={side} position={[side * .45, .225, .67]}>
      <boxGeometry args={[.045, .18, .09]} />
      <meshStandardMaterial color="#303c41" metalness={.76} roughness={.39} />
    </mesh>)}
    <mesh position={[0, .205, .56]} scale={[.2, .065, .31]}>
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial color="#17262c" metalness={.36} roughness={.65} />
    </mesh>
    <mesh position={[0, .31, -.38]} scale={[.205, .105, .41]}>
      <sphereGeometry args={[1, 28, 16]} />
      <meshPhysicalMaterial color="#567888" metalness={.22} roughness={.09}
        clearcoat={1} clearcoatRoughness={.06} transparent opacity={.84} />
    </mesh>
    <mesh position={[0, .24, -.38]} rotation={[-Math.PI / 2, 0, 0]} scale={[.4, .83, 1]}>
      <torusGeometry args={[.5, .026, 8, 28]} />
      <meshStandardMaterial color="#b9b8a6" metalness={.88} roughness={.3} />
    </mesh>
    <mesh position={[0, .275, -.67]}>
      <boxGeometry args={[.23, .015, .11]} />
      <meshBasicMaterial color="#8fdbe0" toneMapped={false} />
    </mesh>

    {([-1, 1] as const).map(side => <group key={side}>
      <SwoopNacelle side={side} textures={textures} shell={geometry.nacelle} deck={geometry.nacelleDeck} />
      <mesh position={[side * .29, -.07, .07]} rotation={[0, 0, side * .62]}>
        <cylinderGeometry args={[.025, .032, .44, 10]} />
        <meshStandardMaterial color="#8d9da0" metalness={.87} roughness={.3} />
      </mesh>
      <mesh>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * .235, -.055, -.85),
          new THREE.Vector3(side * .265, -.12, -.48),
          new THREE.Vector3(side * .27, -.15, .1),
          new THREE.Vector3(side * .325, -.115, .53),
        ]), 28, .018, 6, false]} />
        <meshStandardMaterial color="#172429" metalness={.32} roughness={.7} />
      </mesh>
      <mesh position={[side * .26, .235, .36]} rotation={[0, 0, side * .16]}>
        <boxGeometry args={[.07, .032, .34]} />
        <meshStandardMaterial color="#c2aa83" metalness={.82} roughness={.32} />
      </mesh>
      {[-.22, .16, .51].map(z => <mesh key={z} position={[side * .32, .195, z]}>
        <sphereGeometry args={[.014, 8, 6]} />
        <meshStandardMaterial color="#d7c6a5" metalness={.85} roughness={.35} />
      </mesh>)}
    </group>)}

    <mesh position={[0, .02, .935]}>
      <boxGeometry args={[.22, .13, .1]} />
      <meshStandardMaterial map={textures.armor} metalness={.75} roughness={.38} />
    </mesh>
    <mesh position={[0, .085, .997]}>
      <boxGeometry args={[.17, .045, .018]} />
      <meshBasicMaterial color="#ff5038" toneMapped={false} />
    </mesh>
    <mesh position={[0, -.15, .16]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[.18, .25, 32]} />
      <meshBasicMaterial color="#79d9e8" transparent opacity={.58} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  </group>;
}
