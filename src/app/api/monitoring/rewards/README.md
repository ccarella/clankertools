# Rewards Monitoring API

This endpoint provides monitoring capabilities for creator rewards across all token deployments.

## Authentication

This endpoint requires authentication using a Bearer token. Set the `ADMIN_API_TOKEN` environment variable in your deployment.

```bash
# .env.local or production environment
ADMIN_API_TOKEN=your-secure-admin-token-here
```

## Usage

### GET /api/monitoring/rewards

Fetches deployment data and analyzes creator reward configurations.

#### Headers

```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Query Parameters

- `start` (optional): Start date for the monitoring period (ISO 8601 format)
- `end` (optional): End date for the monitoring period (ISO 8601 format)

If no dates are provided, the endpoint defaults to the last 7 days.

#### Example Requests

```bash
# Last 7 days (default)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain/api/monitoring/rewards

# Custom date range
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://your-domain/api/monitoring/rewards?start=2024-01-01&end=2024-01-31"
```

#### Response Format

```json
{
  "period": {
    "start": "2024-01-24T00:00:00.000Z",
    "end": "2024-01-31T00:00:00.000Z"
  },
  "summary": {
    "totalDeployments": 150,
    "deploymentsWithRewards": 120,
    "deploymentsWithoutRewards": 30,
    "discrepanciesFound": 5
  },
  "discrepancies": [
    {
      "tokenAddress": "0x123...",
      "name": "Test Token",
      "symbol": "TEST",
      "deployedAt": "2024-01-25T10:30:00.000Z",
      "fid": "12345",
      "issue": "Creator reward recipient mismatch",
      "expected": "0xUserWallet",
      "actual": "0xDeployerWallet"
    }
  ],
  "deployments": [
    {
      "tokenAddress": "0x123...",
      "name": "Test Token",
      "symbol": "TEST",
      "createdAt": "2024-01-25T10:30:00.000Z",
      "fid": "12345",
      "creatorAdmin": "0xUserWallet",
      "creatorRewardRecipient": "0xUserWallet",
      "creatorReward": 80,
      "txHash": "0xabc..."
    }
  ]
}
```

## Discrepancy Types

The monitoring endpoint identifies the following types of discrepancies:

1. **Creator reward recipient mismatch**: When a user had a connected wallet with rewards enabled, but the token was deployed with a different reward recipient address.

2. **No creator rewards configured**: When a token was deployed with 0% creator rewards or the reward percentage is missing.

## Security

- The endpoint requires authentication to prevent unauthorized access
- CORS is configured to allow only same-origin requests in production
- All standard security headers are included in responses
- Date ranges are limited to a maximum of 90 days to prevent excessive data processing

## Implementation Notes

### Data Storage

The monitoring endpoint relies on two types of data stored in Redis:

1. **User tokens** (`user:tokens:{fid}`): List of tokens deployed by each user
2. **Deployment details** (`deployment:{tokenAddress}`): Detailed deployment information including reward configurations

### Performance Considerations

- The endpoint uses Redis SCAN to iterate through keys, which is more efficient than KEYS for large datasets
- Results are paginated internally to handle large numbers of deployments
- Consider implementing a separate deployment index for better performance in production

## Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `400 Bad Request`: Invalid date parameters or date range exceeds 90 days
- `500 Internal Server Error`: Redis connection issues or unexpected errors