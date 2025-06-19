import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://clankertools.com'
  
  const manifest = {
    version: '1.0.0',
    name: 'ClankerTools',
    description: 'Launch tokens on Clanker with ease',
    icon: `${baseUrl}/icon-512.svg`,
    splashScreenUrl: `${baseUrl}/splash.png`,
    aboutUrl: `${baseUrl}/about`,
    miniAppUrl: baseUrl,
    notifications: {
      webhookUrl: `${baseUrl}/api/webhook/farcaster`
    },
    homeUrl: baseUrl,
    metadata: {
      theme_color: '#40E0D0',
      background_color: '#282A36'
    }
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}