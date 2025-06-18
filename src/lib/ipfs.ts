export async function uploadToIPFS(imageBlob: Blob): Promise<string> {
  // Validate environment variables
  const apiKey = process.env.IPFS_API_KEY;
  const apiSecret = process.env.IPFS_API_SECRET;

  if (!apiKey || !apiSecret) {
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

  // Pin to IPFS using Pinata
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': apiSecret,
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