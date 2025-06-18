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
    throw new Error('Invalid file type. Only images are allowed');
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

  // Pin to IPFS using Pinata with JWT authentication
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pinataJWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.Hash) {
    throw new Error('Invalid response from IPFS');
  }

  return `ipfs://${data.Hash}`;
}