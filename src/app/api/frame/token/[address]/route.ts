import { NextRequest, NextResponse } from 'next/server';
import { getIpfsUrl } from '@/lib/ipfs';
import { escapeHtml, sanitizeUrl, validateInput, schemas } from '@/lib/security/input-validation';
import { securityHeaders } from '@/lib/security/auth-middleware';
import { rateLimiters } from '@/lib/security/rate-limiter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimiters.public.middleware(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { address } = await params;
  
  // Validate address format
  const addressValidation = validateInput(address, schemas.tokenAddress);
  if (!addressValidation.success) {
    return NextResponse.json(
      { error: 'Invalid token address' }, 
      { status: 400, headers: securityHeaders() }
    );
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
    
    // Sanitize all user-provided data to prevent XSS
    const safeName = escapeHtml(data.name || '');
    const safeSymbol = escapeHtml(data.symbol || '');
    const safeDescription = escapeHtml(data.description || '');
    
    // Validate and sanitize image URL
    const rawImageUrl = getIpfsUrl(data.imageUrl);
    const imageUrl = sanitizeUrl(rawImageUrl) || '';
    
    const frameVersion = request.nextUrl.searchParams.get('version') || 'vNext';

    // Generate frame metadata HTML with escaped content
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="${escapeHtml(frameVersion)}" />
    ${frameVersion === 'v2' ? '<meta property="fc:frame:version" content="v2" />' : ''}
    <meta property="fc:frame:image" content="${escapeHtml(imageUrl)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1:1" />
    
    <meta property="og:title" content="${safeName} ($${safeSymbol})" />
    <meta property="og:description" content="Market Cap: $${formatNumber(data.marketCap)} | Holders: ${escapeHtml(String(data.holders))} | 24h Volume: $${formatNumber(data.volume24h)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
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
    <meta property="fc:frame:button:3:target" content="https://warpcast.com/~/compose?text=${encodeURIComponent(`Check out ${safeName} ($${safeSymbol}) on @clanker!`)}&embeds[]=${encodeURIComponent(request.url)}" />
  </head>
  <body>
    <h1>${safeName} ($${safeSymbol})</h1>
    <img src="${escapeHtml(imageUrl)}" alt="${safeName}" width="400" height="400" />
    <p>Market Cap: $${formatNumber(data.marketCap)}</p>
    <p>Holders: ${escapeHtml(String(data.holders))}</p>
    <p>24h Volume: $${formatNumber(data.volume24h)}</p>
    ${safeDescription ? `<p>${safeDescription}</p>` : ''}
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        ...securityHeaders(),
      },
    });
  } catch (error) {
    console.error('Error generating frame metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token data' },
      { status: 500, headers: securityHeaders() }
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