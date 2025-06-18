# Network Configuration Guide

## Overview

This project supports deployment to both Base mainnet and Base Sepolia testnet. Network selection is controlled via the `BASE_NETWORK` environment variable.

## Configuration

### Environment Variable

Set the `BASE_NETWORK` environment variable in your `.env.local` file:

```bash
# For testnet (default)
BASE_NETWORK=testnet

# For mainnet
BASE_NETWORK=mainnet
```

### Default Behavior

- If `BASE_NETWORK` is not set, the application defaults to **testnet** (Base Sepolia)
- The value is case-insensitive (`mainnet`, `MAINNET`, `Mainnet` all work)
- Whitespace is automatically trimmed

### Network Details

#### Base Sepolia (Testnet)
- Chain ID: `84532` (hex: `0x14A34`)
- RPC URL: `https://sepolia.base.org`
- Network Name: Base Sepolia
- Default network when `BASE_NETWORK` is not set

#### Base Mainnet
- Chain ID: `8453` (hex: `0x2105`)
- RPC URL: `https://mainnet.base.org`
- Network Name: Base
- Use only for production deployments

## Mainnet Deployment Checklist

Before switching to mainnet:

1. **Test thoroughly on testnet** - Ensure all functionality works as expected
2. **Review security** - Double-check private key handling and access controls
3. **Check wallet funding** - Ensure deployer wallet has sufficient ETH for gas
4. **Update environment variables**:
   ```bash
   BASE_NETWORK=mainnet
   DEPLOYER_PRIVATE_KEY=your_mainnet_private_key
   ```
5. **Verify contract addresses** - Ensure all contract addresses (WETH, etc.) are correct for mainnet
6. **Monitor initial deployments** - Watch the first few token deployments carefully

## API Response

The deployment API now includes network information in the response:

```json
{
  "success": true,
  "tokenAddress": "0x...",
  "txHash": "0x...",
  "imageUrl": "ipfs://...",
  "network": "Base Sepolia",  // or "Base" for mainnet
  "chainId": 84532            // or 8453 for mainnet
}
```

## Troubleshooting

### Invalid Network Error
If you see "Invalid BASE_NETWORK value", ensure the value is either `mainnet` or `testnet`.

### Wallet Connection Issues
Users must connect wallets to the correct network:
- The app accepts connections from both Base mainnet and Base Sepolia
- Users will see an error if connected to other networks

### RPC Errors
If you experience RPC errors, the default RPC endpoints may be rate-limited. Consider using your own RPC provider by modifying the network configuration.

## Development Tips

1. Always start development on testnet
2. Use separate `.env.local` files for different environments
3. Never commit mainnet private keys to version control
4. Consider using different deployer wallets for testnet and mainnet

## Security Considerations

- The `DEPLOYER_PRIVATE_KEY` should be kept secure and never exposed
- Use environment-specific keys (different keys for testnet/mainnet)
- Monitor deployer wallet balances and transactions
- Consider using a hardware wallet or secure key management service for mainnet