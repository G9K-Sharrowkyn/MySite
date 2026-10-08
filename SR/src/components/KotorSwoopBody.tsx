import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createSwoopHullGeometry, createSwoopTopPanelGeometry, createSwoopWingGeometry } from './SwoopBodyGeometry';
import type { HullSection } from './SwoopBodyGeometry';
import { createSwoopVehicleTextures, disposeSwoopVehicleTextures } from './SwoopVehicleTextures';

// Long central spear and separate engines follow the low, open KOTOR racer silhouette.
const FUSELAGE: HullSection[] = [
  { z: -1.91, width: .018, top: -.005, bottom: -.05 },
  { z: -1.56, width: .05, top: .035, bottom: -.09 },
  { z: -1.09, width: .13, top: .11, bottom: -.12 },
  { z: -.68, width: .17, top: .16, bottom: -.14 },
  { z: -.11, width: .18, top: .14, bottom: -.15 },
  { z: .48, width: .17, top: .12, bottom: -.14 },
  { z: 1.06, width: .115, top: .08, bottom: -.105 },
];
const REAR_COWL: HullSection[] = [
  { z: .31, width: .08, top: .19, bottom: .08 },
  { z: .48, width: .13, top: .19, bottom: .055 },
  { z: .91, width: .115, top: .145, bottom: .015 },
  { z: 1.14, width: .02, top: .045, bottom: -.04 },
];

function createEngineGeometry() {
  const profile = [
    [-1.69, .018], [-1.47, .045], [-1.18, .075], [-.89, .09],
    [-.64, .12], [-.43, .13], [-.22, .145], [.19, .16],
    [.57, .18], [.73, .18], [.81, .14],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([z, radius]) => new THREE.Vector2(radius, z)), 20);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function KotorSwoopBody() {
  const textures = useMemo(createSwoopVehicleTextures, []);
  const geometry = useMemo(() => ({
    fuselage: createSwoopHullGeometry(FUSELAGE),
    spinePanel: createSwoopTopPanelGeometry(FUSELAGE.slice(2, 6)),
    rearCowl: createSwoopHullGeometry(REAR_COWL),
    engine: createEngineGeometry(),
    wing: createSwoopWingGeometry([
      [.12, -.48], [.36, -.68], [.62, -.75], [.78, -.37],
      [.77, .4], [.58, .52], [.18, .31],
    ], .045),
    wingInset: createSwoopWingGeometry([
      [.37, -.4], [.59, -.55], [.7, -.25], [.69, .25],
      [.55, .35], [.36, .18],
    ], .012),
  }), []);
  useEffect(() => () => {
    disposeSwoopVehicleTextures(textures);
    Object.values(geometry).forEach(part => part.dispose());
  }, [textures, geometry]);

  return <group>
    <mesh geometry={geometry.fuselage}>
      <meshPhysicalMaterial map={textures.paint} bumpMap={textures.paintBump} bumpScale={.012}
        metalness={.52} roughness={.48} clearcoat={.18} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={geometry.spinePanel}>
      <meshStandardMaterial map={textures.armor} metalness={.56} roughness={.52} side={THREE.DoubleSide} />
    </mesh>

    {/* Opaque windscreen and exposed seat replace the tall glass bubble. */}
    <mesh position={[0, .178, -.46]} scale={[.125, .038, .43]}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshPhysicalMaterial color="#14262d" metalness={.45} roughness={.24} clearcoat={.32} />
    </mesh>
    <mesh position={[0, .172, -.86]}>
      <boxGeometry args={[.18, .015, .015]} />
      <meshBasicMaterial color="#9dc5c4" toneMapped={false} />
    </mesh>
    <mesh position={[0, .15, .2]} scale={[.13, .065, .23]}>
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial color="#192225" metalness={.16} roughness={.86} />
    </mesh>
    <mesh position={[0, .2, .43]} scale={[.14, .15, .11]}>
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial color="#6c6055" metalness={.28} roughness={.65} />
    </mesh>
    <mesh geometry={geometry.rearCowl}>
      <meshStandardMaterial color="#9b9f98" metalness={.5} roughness={.52} side={THREE.DoubleSide} />
    </mesh>

    {([-1, 1] as const).map(side => <group key={side} scale={[side, 1, 1]}>
      {/* Thin swept wings with a separate pale service plate. */}
      <mesh geometry={geometry.wing} position={[0, .045, 0]}>
        <meshStandardMaterial map={textures.paint} metalness={.48} roughness={.52} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry.wingInset} position={[0, .065, 0]}>
        <meshStandardMaterial color="#9da5a1" metalness={.5} roughness={.52} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[.66, .084, -.05]} rotation={[0, -.15, 0]}>
        <boxGeometry args={[.015, .008, .52]} />
        <meshStandardMaterial color="#384a4c" metalness={.6} roughness={.48} />
      </mesh>

      <group position={[.4, 0, 0]}>
        <mesh geometry={geometry.engine}>
          <meshPhysicalMaterial map={textures.paint} bumpMap={textures.paintBump} bumpScale={.014}
            metalness={.59} roughness={.44} clearcoat={.16} side={THREE.DoubleSide} />
        </mesh>
        {[-.18, .04, .27, .59].map((z, index) => <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[index === 3 ? .176 : .15 + index * .005, .012, 8, 28]} />
          <meshStandardMaterial color={index === 3 ? '#a6a7a0' : '#344247'} metalness={.8} roughness={.4} />
        </mesh>)}
        <mesh position={[0, 0, .79]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[.185, .185, .19, 28]} />
          <meshStandardMaterial map={textures.armor} metalness={.75} roughness={.39} />
        </mesh>
        <mesh position={[0, 0, .9]}>
          <torusGeometry args={[.177, .023, 10, 32]} />
          <meshStandardMaterial color="#bdc3bd" metalness={.85} roughness={.31} />
        </mesh>
        <mesh position={[0, .135, .21]}>
          <boxGeometry args={[.13, .02, .55]} />
          <meshStandardMaterial color="#2b393c" metalness={.7} roughness={.44} />
        </mesh>
        {[-.04, .08, .2, .32].map(z => <mesh key={z} position={[0, .152, z]}>
          <boxGeometry args={[.1, .006, .022]} />
          <meshStandardMaterial color="#a1aaa4" metalness={.72} roughness={.39} />
        </mesh>)}
      </group>

      <mesh position={[.25, -.055, .33]} rotation={[0, 0, -.22]}>
        <boxGeometry args={[.055, .085, .79]} />
        <meshStandardMaterial color="#596769" metalness={.73} roughness={.42} />
      </mesh>
      <mesh position={[.4, -.16, .46]} scale={[.11, .065, .36]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#30383a" metalness={.55} roughness={.55} />
      </mesh>
    </group>)}

    <mesh position={[0, -.09, .54]}>
      <boxGeometry args={[.76, .055, .17]} />
      <meshStandardMaterial color="#655e55" metalness={.62} roughness={.53} />
    </mesh>
    <mesh position={[0, -.12, .93]}>
      <boxGeometry args={[.12, .09, .07]} />
      <meshStandardMaterial color="#a8a396" metalness={.6} roughness={.46} />
    </mesh>
    <mesh position={[0, -.09, .975]}>
      <boxGeometry args={[.085, .027, .012]} />
      <meshBasicMaterial color="#f14b30" toneMapped={false} />
    </mesh>
  </group>;
}
