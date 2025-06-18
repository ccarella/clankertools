import { NextRequest, NextResponse } from 'next/server';
import { getIpfsUrl } from '@/lib/ipfs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  
  // Validate address format
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
  }

  try {
    // Fetch token data from the API
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/token/${address}`);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.success) {
      return NextResponse.json(
        { error: tokenData.error || 'Token not found' },
        { status: tokenResponse.status }
      );
    }

    const { data } = tokenData;
    const imageUrl = getIpfsUrl(data.imageUrl);
    const frameVersion = request.nextUrl.searchParams.get('version') || 'vNext';

    // Generate frame metadata HTML
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="${frameVersion}" />
    ${frameVersion === 'v2' ? '<meta property="fc:frame:version" content="v2" />' : ''}
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="fc:frame:image:aspect_ratio" content="1:1" />
    
    <meta property="og:title" content="${data.name} ($${data.symbol})" />
    <meta property="og:description" content="Market Cap: $${formatNumber(data.marketCap)} | Holders: ${data.holders} | 24h Volume: $${formatNumber(data.volume24h)}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${request.nextUrl.origin}/token/${address}" />
    
    <meta property="fc:frame:button:1" content="View Token" />
    <meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="${request.nextUrl.origin}/token/${address}" />
    
    <meta property="fc:frame:button:2" content="Trade on DEX" />
    <meta property="fc:frame:button:2:action" content="link" />
    <meta property="fc:frame:button:2:target" content="https://dex.clanker.world/token/${address}" />
    
    <meta property="fc:frame:button:3" content="Share" />
    <meta property="fc:frame:button:3:action" content="link" />
    <meta property="fc:frame:button:3:target" content="https://warpcast.com/~/compose?text=${encodeURIComponent(`Check out ${data.name} ($${data.symbol}) on @clanker!`)}&embeds[]=${encodeURIComponent(request.url)}" />
  </head>
  <body>
    <h1>${data.name} ($${data.symbol})</h1>
    <img src="${imageUrl}" alt="${data.name}" width="400" height="400" />
    <p>Market Cap: $${formatNumber(data.marketCap)}</p>
    <p>Holders: ${data.holders}</p>
    <p>24h Volume: $${formatNumber(data.volume24h)}</p>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error generating frame metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token data' },
      { status: 500 }
    );
  }
}

function formatNumber(num: string | number): string {
  const value = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}