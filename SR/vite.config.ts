import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const TRACK_IDS = ['taris', 'tatooine', 'manaan', 'korriban'] as const
const TRACK_LENGTHS: Record<(typeof TRACK_IDS)[number], number> = {
  taris: 3000,
  tatooine: 4200,
  manaan: 5100,
  korriban: 6000,
}
const EVENT_TYPES = new Set(['boulder', 'gate', 'wall', 'lowBarrier', 'mine', 'boost'])
const SIDES = new Set(['left', 'right', 'center'])

function sanitizeEvent(raw: unknown, trackLength: number) {
  if (!raw || typeof raw !== 'object') return null
  const event = raw as Record<string, unknown>
  if (!EVENT_TYPES.has(String(event.type))) return null
  if (typeof event.distance !== 'number' || !Number.isFinite(event.distance)) return null
  if (typeof event.x !== 'number' || !Number.isFinite(event.x)) return null

  const clean: Record<string, unknown> = {
    distance: Math.round(Math.max(1, Math.min(trackLength - 1, event.distance))),
    type: event.type,
    x: Math.max(-2.6, Math.min(2.6, event.x)),
  }
  if (typeof event.width === 'number' && Number.isFinite(event.width)) {
    clean.width = Math.max(1.4, Math.min(4.5, event.width))
  }
  if (SIDES.has(String(event.side))) clean.side = event.side
  return clean
}

function normalizeTrackFile(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as { tracks?: unknown }
  if (!payload.tracks || typeof payload.tracks !== 'object') return null
  const source = payload.tracks as Record<string, unknown>
  const tracks: Record<string, unknown[]> = {}

  for (const id of TRACK_IDS) {
    if (!Array.isArray(source[id])) return null
    const events = source[id].map((event) => sanitizeEvent(event, TRACK_LENGTHS[id]))
    if (events.some((event) => event === null)) return null
    tracks[id] = (events as Record<string, unknown>[]).sort(
      (a, b) => Number(a.distance) - Number(b.distance),
    )
  }

  return { version: 1, tracks }
}

function trackFilePersistence(): Plugin {
  const targetPath = path.resolve(import.meta.dirname, 'src/game/trackLayouts.json')

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/track-layouts' || req.method !== 'POST') {
      next()
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) req.destroy(new Error('Payload too large'))
      else chunks.push(chunk)
    })
    req.on('end', async () => {
      try {
        const normalized = normalizeTrackFile(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        if (!normalized) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Niepoprawny układ trasy.' }))
          return
        }

        const temporaryPath = `${targetPath}.tmp`
        await fs.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
        await fs.rename(temporaryPath, targetPath)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, path: 'src/game/trackLayouts.json' }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Błąd zapisu.' }))
      }
    })
  }

  return {
    name: 'track-file-persistence',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/swoop-racing/',
  build: {
    outDir: path.resolve(import.meta.dirname, '../public/swoop-racing'),
    emptyOutDir: true,
  },
  plugins: [trackFilePersistence(), react()],
})
