export function getIpfsUrl(ipfsUri: string): string {
  if (!ipfsUri) return '';
  
  // If it's already an HTTP URL, return as is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }
  
  // Convert ipfs:// to gateway URL
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  }
  
  // If it's just a hash, prepend gateway URL
  return `https://gateway.pinata.cloud/ipfs/${ipfsUri}`;
}

export async function uploadToIPFS(imageBlob: Blob): Promise<string> {
  // Validate environment variables
  const pinataJWT = process.env.PINATA_JWT;

  if (!pinataJWT) {
    console.error('[IPFS] Missing PINATA_JWT environment variable');
    throw new Error('IPFS credentials not configured');
  }

  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (imageBlob.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(imageBlob.type)) {
    throw new Error(`Invalid file type. Only images are allowed (PNG, JPEG, GIF, WebP). Received: ${imageBlob.type || 'unknown'}`);
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', imageBlob);
  
  // Add metadata
  const metadata = JSON.stringify({
    name: `clanker-token-${Date.now()}`,
    keyvalues: {
      type: 'token-image',
      timestamp: Date.now().toString(),
    }
  });
  formData.append('pinataMetadata', metadata);

  // Pin to IPFS using Pinata v3 API with JWT authentication
  console.log('[IPFS] Uploading file to Pinata v3...', {
    fileSize: imageBlob.size,
    fileType: imageBlob.type,
  });
  
  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pinataJWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[IPFS] Upload failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  console.log('[IPFS] Upload response:', responseData);
  
  // Handle both direct response and data-wrapped response
  const data = responseData.data || responseData;
  
  if (!data.cid) {
    console.error('[IPFS] Invalid response structure:', responseData);
    throw new Error(`Invalid response from IPFS: ${JSON.stringify(responseData)}`);
  }

  return `ipfs://${data.cid}`;
}