import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { PCFSoftShadowMap } from 'three'
import { Arena } from './Arena'
import { Bot } from './Bot'
import { PlayerController } from './PlayerController'
import { ProjectileSystem } from './ProjectileSystem'

export function GameScene() {
  return (
    <Canvas
      shadows
      camera={{ fov: 72, near: 0.05, far: 90, position: [0, 1.7, 18] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFSoftShadowMap
        gl.domElement.setAttribute('aria-label', 'Pole gry 3D')
      }}
    >
      <Arena />
      <Suspense fallback={null}>
        {[0, 1, 2, 3, 4].map((id) => <Bot key={id} id={id} />)}
      </Suspense>
      <ProjectileSystem />
      <PlayerController />
    </Canvas>
  )
}
