import { useEffect, useMemo } from 'react';
import { createIndustrialSurfaces, disposeIndustrialSurfaces } from './IndustrialSurfaces';
import { useGameStore } from '../store/gameStore';

// Visual-only fairings: the playable swoop keeps the existing collision envelope.
export function SwoopBodyDetails() {
  const enhanced = useGameStore(state => state.selectedTrack === 'taris2');
  const surfaces = useMemo(() => enhanced ? createIndustrialSurfaces() : null, [enhanced]);
  useEffect(() => () => { if (surfaces) disposeIndustrialSurfaces(surfaces); }, [surfaces]);
  return <group>
    <mesh position={[0, -0.03, -0.42]} scale={[0.24, 0.12, 0.76]}>
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial color="#253a42" metalness={0.78} roughness={0.27} />
    </mesh>
    <mesh position={[0, 0.13, -0.62]} scale={[0.17, 0.07, 0.46]}>
      <sphereGeometry args={[1, 16, 8]} />
      <meshStandardMaterial color="#7195a0" metalness={0.72} roughness={0.25} />
    </mesh>
    <mesh position={[0, 0.025, -1.22]} rotation={[-Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.12, 0.35, 10]} />
      <meshStandardMaterial color="#a2aeb0" metalness={0.86} roughness={0.22} />
    </mesh>
    <mesh position={[0, 0.22, 0.24]} scale={[0.2, 0.075, 0.33]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial color="#141b1e" metalness={0.25} roughness={0.9} />
    </mesh>
    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[side * 0.48, 0.08, -0.46]} rotation={[0, side * 0.1, side * 0.19]}>
        <boxGeometry args={[0.11, 0.14, 1.12]} />
        <meshStandardMaterial map={surfaces?.paint} color={surfaces ? '#ffffff' : '#a3472f'} metalness={surfaces ? .66 : .67} roughness={surfaces ? .43 : .38} />
      </mesh>
      {surfaces && <mesh position={[side * .48, .04, -.44]} rotation={[0, side * .1, side * .19]} scale={[.13, .1, .57]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial map={surfaces.paint} metalness={.66} roughness={.41} />
      </mesh>}
      <mesh position={[side * 0.47, 0.17, -0.29]} rotation={[0, side * 0.1, side * 0.19]}>
        <boxGeometry args={[0.04, 0.035, 0.75]} />
        <meshStandardMaterial color="#e3bc76" emissive="#aa602e" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[side * 0.45, -0.12, 0.38]} rotation={[0, 0, side * 0.35]}>
        <boxGeometry args={[0.13, 0.18, 0.72]} />
        <meshStandardMaterial color="#273b42" metalness={0.8} roughness={0.24} />
      </mesh>
      {surfaces && <mesh position={[side * .4, .16, .54]} rotation={[0, 0, side * .15]}>
        <boxGeometry args={[.27, .055, .38]} />
        <meshStandardMaterial map={surfaces.paint} metalness={.67} roughness={.45} />
      </mesh>}
      {surfaces && [-.34, -.22, -.1].map(z => <mesh key={z} position={[side * .4, .172, z + .78]}>
        <boxGeometry args={[.19, .015, .03]} />
        <meshStandardMaterial color="#162830" metalness={.58} roughness={.61} />
      </mesh>)}
      <mesh position={[side * 0.51, 0.26, 0.58]} rotation={[0, 0, side * 0.38]}>
        <boxGeometry args={[0.08, 0.3, 0.28]} />
        <meshStandardMaterial color="#a4adb1" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[side * 0.3, 0.22, -0.68]} rotation={[0, side * .32, 0]}>
        <boxGeometry args={[0.3, 0.035, 0.31]} />
        <meshStandardMaterial color="#242d32" metalness={0.8} roughness={0.28} />
      </mesh>
      {surfaces && <mesh position={[side * .56, .015, .73]} rotation={[0, 0, side * .08]}>
        <torusGeometry args={[.155, .018, 8, 24]} />
        <meshStandardMaterial color="#d1c3a4" metalness={.78} roughness={.33} />
      </mesh>}
      {surfaces && [-.45, .43].map(z => <mesh key={z} position={[side * .485, .204, z]}>
        <sphereGeometry args={[.018, 8, 6]} />
        <meshStandardMaterial color="#d1c5a5" metalness={.83} roughness={.32} />
      </mesh>)}
      <mesh position={[side * 0.25, 0.06, -1.13]}>
        <boxGeometry args={[0.07, 0.035, 0.09]} />
        <meshStandardMaterial color="#bdeff0" emissive="#5cb7ca" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>)}
    <mesh position={[0, -0.11, 0.7]}>
      <boxGeometry args={[0.21, 0.08, 0.22]} />
      <meshStandardMaterial color="#576970" metalness={0.7} roughness={0.36} />
    </mesh>
    {surfaces && <mesh position={[0, .227, -.18]} rotation={[-.15, 0, 0]} scale={[.19, .045, .42]}>
      <sphereGeometry args={[1, 20, 10]} />
      <meshPhysicalMaterial color="#789eaa" metalness={.12} roughness={.11} clearcoat={1} clearcoatRoughness={.06} transparent opacity={.72} />
    </mesh>}
    <mesh position={[0, -0.1, 0.82]}>
      <boxGeometry args={[0.16, 0.025, 0.03]} />
      <meshStandardMaterial color="#d45835" emissive="#ec3a15" emissiveIntensity={2} toneMapped={false} />
    </mesh>
  </group>;
}
