import { NextResponse } from 'next/server'

export async function GET() {
  const manifest = {
    version: '1',
    name: 'Clanker Tools',
    short_name: 'Clanker',
    launch_url: '/',
    start_url: '/',
    display: 'standalone',
    theme_color: '#40E0D0',
    background_color: '#282A36',
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml'
      }
    ]
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}