# Specific Test Recommendations for Low Coverage Files

## 1. Redis Storage Tests (/src/lib/redis.ts - 38.09% coverage)

### Missing Test Cases:
```typescript
// Create file: src/lib/__tests__/redis.test.ts

describe('Redis Client', () => {
  describe('getRedisClient', () => {
    it('should throw error when environment variables are missing');
    it('should create singleton instance');
    it('should reuse existing client on subsequent calls');
  });

  describe('storeUserToken', () => {
    it('should store new token for user');
    it('should not duplicate existing tokens');
    it('should handle Redis connection failures');
    it('should set expiration time correctly');
    it('should handle case-insensitive token addresses');
  });

  describe('getUserTokens', () => {
    it('should return empty array for new user');
    it('should paginate results correctly');
    it('should sort tokens by creation date');
    it('should handle invalid cursor values');
    it('should handle Redis connection failures');
  });

  describe('updateUserTokenMetrics', () => {
    it('should update existing token metrics');
    it('should handle non-existent tokens gracefully');
    it('should preserve other token properties');
    it('should handle Redis connection failures');
    it('should handle case-insensitive token addresses');
  });
});
```

## 2. Token API Route Tests (/src/app/api/token/[address]/route.ts - 69.14% coverage)

### Missing Error Scenarios:
```typescript
// Add to existing test file: src/app/api/token/[address]/__tests__/route.test.ts

describe('Error Handling', () => {
  it('should handle Redis connection failures during cache check');
  it('should handle blockchain RPC failures');
  it('should handle malformed token contract responses');
  it('should handle rate limiting (429 responses)');
  it('should handle timeout scenarios');
  it('should handle IPFS gateway failures for images');
});

describe('Price Calculation Edge Cases', () => {
  it('should handle tokens with zero liquidity');
  it('should handle extremely large token supplies');
  it('should handle precision loss in price calculations');
  it('should handle negative price changes correctly');
  it('should handle missing pool data across all fee tiers');
});

describe('Security Tests', () => {
  it('should sanitize token addresses to prevent injection');
  it('should validate response data before caching');
  it('should handle concurrent requests for same token');
  it('should enforce cache TTL correctly');
});
```

## 3. Simple Launch Components (/src/components/simple-launch/* - 51.64% coverage)

### Critical Missing Tests:

#### ErrorStep.tsx (15.38% coverage):
```typescript
describe('ErrorStep', () => {
  it('should display deployment errors clearly');
  it('should show retry button for recoverable errors');
  it('should provide error details for debugging');
  it('should handle wallet connection errors');
  it('should handle IPFS upload failures');
  it('should handle Clanker API errors');
  it('should track error analytics');
});
```

#### FormStep.tsx (49.05% coverage):
```typescript
describe('FormStep', () => {
  it('should validate token name length and characters');
  it('should validate symbol format (uppercase, length)');
  it('should handle image upload size limits');
  it('should validate image file types');
  it('should show real-time fee calculations');
  it('should handle wallet connection during form fill');
  it('should preserve form data on navigation');
  it('should handle cast context data correctly');
});
```

## 4. Authentication Edge Cases (/src/components/providers/FarcasterAuthProvider.tsx)

### Missing Tests:
```typescript
describe('Authentication Edge Cases', () => {
  it('should handle SDK initialization failures');
  it('should handle authentication timeouts');
  it('should handle invalid user data from SDK');
  it('should retry failed authentication attempts');
  it('should clear stale session data');
  it('should handle frame context errors');
  it('should validate nonce generation');
});
```

## 5. Wallet Provider Tests (/src/providers/WalletProvider.tsx)

### Missing Financial Operation Tests:
```typescript
describe('Wallet Connection Failures', () => {
  it('should handle network switching failures');
  it('should handle wallet disconnection during transaction');
  it('should validate chain ID before transactions');
  it('should handle insufficient balance errors');
  it('should handle user rejection of transactions');
  it('should handle wallet lock during operation');
  it('should recover from provider errors');
});
```

## 6. Deploy API Security Tests (/src/app/api/deploy/simple/route.ts)

### Critical Security Tests:
```typescript
describe('Deployment Security', () => {
  it('should validate all input parameters');
  it('should prevent double deployments');
  it('should handle concurrent deployment requests');
  it('should validate wallet ownership');
  it('should enforce rate limits per FID');
  it('should sanitize token metadata');
  it('should validate image uploads for malicious content');
  it('should handle transaction reversion');
  it('should log security events');
});
```

## Integration Test Recommendations

### 1. End-to-End Token Deployment Flow:
```typescript
describe('Complete Token Deployment', () => {
  it('should deploy token from start to finish');
  it('should handle network issues during deployment');
  it('should verify token on blockchain after deployment');
  it('should update user token list after deployment');
  it('should handle deployment failures gracefully');
});
```

### 2. Authentication + Wallet Flow:
```typescript
describe('Auth and Wallet Integration', () => {
  it('should connect wallet after Farcaster auth');
  it('should maintain wallet connection across sessions');
  it('should handle wallet disconnection during auth');
  it('should validate wallet ownership matches FID');
});
```

## Test Implementation Priority

### Immediate (Security Critical):
1. Redis storage tests (user data persistence)
2. Deploy API input validation tests
3. Wallet transaction error handling

### High Priority:
1. Token API error scenarios
2. Authentication edge cases
3. Simple launch error handling

### Medium Priority:
1. Form validation tests
2. Price calculation edge cases
3. Performance monitoring tests

## Testing Best Practices

1. **Mock External Dependencies**: Always mock Redis, blockchain RPC, IPFS, and Clanker SDK
2. **Test Error Paths**: Focus on error scenarios and edge cases
3. **Validate Security**: Test input validation, sanitization, and rate limiting
4. **Test Concurrency**: Ensure handlers work correctly with concurrent requests
5. **Mobile Testing**: Test touch interactions and mobile viewports
6. **Performance**: Add tests for response times and caching behavior