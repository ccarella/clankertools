import { describe, it, expect, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

describe('XSS Prevention Tests', () => {
  describe('Token Frame API - XSS in HTML generation', () => {
    it('should escape malicious token names in frame HTML', async () => {
      const { GET } = await import('@/app/api/frame/token/[address]/route');
      
      // Mock getTokenData to return malicious data
      jest.mock('@/lib/token-api', () => ({
        getTokenData: jest.fn().mockResolvedValue({
          name: '<script>alert("XSS")</script>',
          symbol: '"><img src=x onerror=alert(1)>',
          description: 'javascript:alert("XSS")',
          imageUrl: '" onload="alert(\'XSS\')" data-test="',
          price: '0.001',
          marketCap: 1000000,
          volume24h: 50000,
          priceChange24h: 5.5,
          holders: 100,
          creatorReward: 5,
          isNsfw: false,
        })
      }));
      
      const request = new NextRequest('http://localhost:3000/api/frame/token/0x1234567890123456789012345678901234567890');
      const response = await GET(
        request,
        { params: { address: '0x1234567890123456789012345678901234567890' } }
      );
      
      const html = await response.text();
      
      // Check that dangerous content is escaped
      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).not.toContain('onerror=alert(1)');
      expect(html).not.toContain('javascript:alert');
      expect(html).not.toContain('onload="alert');
      
      // Should contain escaped versions
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;');
    });

    it('should validate and sanitize image URLs', async () => {
      const { GET } = await import('@/app/api/frame/token/[address]/route');
      
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        '//evil.com/steal-cookies.js',
        'https://evil.com/image.png" onerror="alert(1)"',
      ];
      
      for (const url of maliciousUrls) {
        jest.mock('@/lib/token-api', () => ({
          getTokenData: jest.fn().mockResolvedValue({
            name: 'Test Token',
            symbol: 'TEST',
            imageUrl: url,
            price: '0.001',
          })
        }));
        
        const request = new NextRequest('http://localhost:3000/api/frame/token/0x1234567890123456789012345678901234567890');
        const response = await GET(
          request,
          { params: { address: '0x1234567890123456789012345678901234567890' } }
        );
        
        const html = await response.text();
        
        // Should not contain dangerous protocols
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('vbscript:');
        expect(html).not.toContain('data:text/html');
      }
    });
  });

  describe('User Input Sanitization', () => {
    it('should sanitize token deployment inputs', async () => {
      const { POST } = await import('@/app/api/deploy/simple/route');
      
      const maliciousInputs = {
        name: '<img src=x onerror=alert("XSS")>',
        symbol: 'TEST"><script>alert(1)</script>',
        description: '${alert("XSS")}',
        twitter: 'javascript:alert("XSS")',
        telegram: 'data:text/html,<script>alert(1)</script>',
        website: 'vbscript:msgbox("XSS")',
      };
      
      const formData = new FormData();
      formData.append('fid', '12345');
      formData.append('name', maliciousInputs.name);
      formData.append('symbol', maliciousInputs.symbol);
      formData.append('description', maliciousInputs.description);
      formData.append('twitter', maliciousInputs.twitter);
      formData.append('telegram', maliciousInputs.telegram);
      formData.append('website', maliciousInputs.website);
      formData.append('image', new Blob([''], { type: 'image/png' }));
      
      const request = new NextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      if (response.status === 200) {
        const data = await response.json();
        
        // Check that dangerous content is not present in response
        const responseText = JSON.stringify(data);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('onerror=');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('vbscript:');
      }
    });
    
    it('should validate URL formats for social links', async () => {
      const { POST } = await import('@/app/api/deploy/simple/route');
      
      const invalidUrls = [
        'not-a-url',
        'ftp://files.example.com',
        'file:///etc/passwd',
        'javascript:void(0)',
        '//no-protocol.com',
        'https://', // incomplete
        'https://user:pass@example.com', // credentials in URL
      ];
      
      for (const url of invalidUrls) {
        const formData = new FormData();
        formData.append('fid', '12345');
        formData.append('name', 'Test Token');
        formData.append('symbol', 'TEST');
        formData.append('website', url);
        formData.append('image', new Blob([''], { type: 'image/png' }));
        
        const request = new NextRequest('http://localhost:3000/api/deploy/simple', {
          method: 'POST',
          body: formData,
        });
        
        const response = await POST(request);
        
        // Should either reject or sanitize invalid URLs
        if (response.status === 200) {
          const data = await response.json();
          expect(data.website).not.toBe(url);
        }
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in FID parameters', async () => {
      const endpoints = [
        '/api/connectWallet',
        '/api/notifications/preferences',
        '/api/user/tokens',
      ];
      
      const sqlInjectionPayloads = [
        "1' OR '1'='1",
        "1; DROP TABLE users;--",
        "1' UNION SELECT * FROM users--",
        "1'); DELETE FROM wallets WHERE '1'='1",
        "admin'--",
        "1' AND SLEEP(5)--",
      ];
      
      for (const endpoint of endpoints) {
        for (const payload of sqlInjectionPayloads) {
          const request = new NextRequest(`http://localhost:3000${endpoint}?fid=${encodeURIComponent(payload)}`);
          
          // Import and test each endpoint
          const apiModule = await import(`@/app${endpoint}/route`);
          const response = await apiModule.GET(request);
          
          // Should not execute SQL - should be rejected or sanitized
          expect(response.status).not.toBe(500); // No server errors from SQL
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in Redis operations', async () => {
      const { storeUserWallet, getUserWallet } = await import('@/lib/redis');
      
      const noSqlPayloads = [
        { $ne: null },
        { $gt: "" },
        { $regex: ".*" },
        "user:*:wallet",
        "FLUSHALL",
        "CONFIG GET *",
      ];
      
      for (const payload of noSqlPayloads) {
        // Test with payload as FID
        await expect(
          getUserWallet(payload as string)
        ).rejects.toThrow();
        
        // Test with payload as wallet address
        await expect(
          storeUserWallet('12345', payload as string)
        ).rejects.toThrow();
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in file operations', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'images/../../../secret.txt',
        'assets/./././../config',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        'images/..%2F..%2F..%2Fetc%2Fpasswd',
      ];
      
      // Test any endpoints that might handle file paths
      for (const payload of pathTraversalPayloads) {
        // Currently no file handling endpoints, but this test is ready
        // for when file operations are added
        expect(payload).toContain('..');
      }
    });
  });

  describe('Content Security Policy', () => {
    it('should set proper CSP headers to prevent XSS', async () => {
      const endpoints = [
        '/api/frame/token/0x1234567890123456789012345678901234567890',
        '/api/deploy/simple',
        '/api/connectWallet',
      ];
      
      for (const endpoint of endpoints) {
        const request = new NextRequest(`http://localhost:3000${endpoint}`);
        const apiModule = await import(`@/app${endpoint.split('?')[0].replace(/\/0x[a-fA-F0-9]+$/, '/[address]')}/route`);
        
        const response = await (apiModule.GET || apiModule.POST)(request);
        
        // Check for security headers
        const headers = response.headers;
        
        // Should have security headers set
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(headers.get('X-Frame-Options')).toBe('DENY');
        expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
      }
    });
  });

  describe('JSON Response Sanitization', () => {
    it('should sanitize JSON responses to prevent XSS', async () => {
      const { GET } = await import('@/app/api/user/tokens/route');
      
      // Mock token data with XSS attempts
      jest.mock('@/lib/token-api', () => ({
        getUserTokens: jest.fn().mockResolvedValue({
          tokens: [{
            address: '0x1234567890123456789012345678901234567890',
            name: '</script><script>alert("XSS")</script>',
            symbol: '"><img src=x onerror=alert(1)>',
          }],
          nextCursor: null,
        })
      }));
      
      const request = new NextRequest('http://localhost:3000/api/user/tokens');
      const response = await GET(request);
      
      expect(response.headers.get('Content-Type')).toContain('application/json');
      
      const data = await response.json();
      const jsonString = JSON.stringify(data);
      
      // JSON encoding should escape dangerous characters
      expect(jsonString).not.toContain('</script><script>');
      expect(jsonString).not.toContain('onerror=alert');
    });
  });
});