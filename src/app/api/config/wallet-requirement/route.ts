import { NextResponse } from 'next/server';

export async function GET() {
  const requireWallet = process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH === 'true';
  
  const response = NextResponse.json({ requireWallet });
  
  // Add cache headers
  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  return response;
}