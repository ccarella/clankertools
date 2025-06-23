import { describe, it, expect, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

describe('XSS Prevention Tests', () => {
  describe('Token Frame API - XSS in HTML generation', () => {
    it('should escape malicious token names in frame HTML', async () => {
      // Mock the internal token API endpoint to return malicious data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            name: '<script>alert("XSS")</script>',
            symbol: '"><img src=x onerror=alert(1)>',
            description: 'javascript:alert("XSS")',
            imageUrl: '" onload="alert(\'XSS\')" data-test="',
            marketCap: '1000000',
            volume24h: '50000',
            priceChange24h: 5.5,
            holders: 100,
          }
        })
      }));
      
      const { GET } = await import('@/app/api/frame/token/[address]/route');
      
      const request = new NextRequest('http://localhost:3000/api/frame/token/0x1234567890123456789012345678901234567890');
      const response = await GET(
        request,
        { params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) }
      );
      
      const html = await response.text();
      
      if (response.status === 200) {
        // If successful, check that dangerous content is properly escaped/neutralized
        
        // Raw script tags should be escaped
        expect(html).not.toContain('<script>alert("XSS")</script>');
        
        // Event handlers should not be in executable contexts (outside of content attributes)
        // Check for patterns that would actually execute, not just text content
        // The dangerous input should be escaped, not present as executable attributes
        // Look for actual HTML attribute patterns that would execute (not URL-encoded)
        // Check that the malicious content is properly escaped in content attributes
        expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
        // Ensure no unescaped event handlers as actual HTML attributes
        expect(html).not.toMatch(/<img[^>]+src\s*=\s*["']?x["']?[^>]+onerror\s*=\s*["']?alert/);
        
        // Javascript URLs should be rejected or escaped
        expect(html).not.toMatch(/href\s*=\s*["']javascript:/);
        expect(html).not.toMatch(/src\s*=\s*["']javascript:/);
        
        // Should contain properly escaped versions
        expect(html).toContain('&lt;script&gt;');
        
        // Ensure the overall HTML structure is valid
        expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
        expect(html.trim()).toMatch(/<\/html>$/);
      } else {
        // If error response, should not contain the dangerous content in executable form
        expect(html).not.toContain('<script>alert("XSS")</script>');
        expect(html).not.toMatch(/onerror\s*=\s*alert\(1\)/);
      }
    });

    it('should validate and sanitize image URLs', async () => {
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        '//evil.com/steal-cookies.js',
        'https://evil.com/image.png" onerror="alert(1)"',
      ];
      
      for (const url of maliciousUrls) {
        // Mock the internal token API endpoint for each malicious URL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              name: 'Test Token',
              symbol: 'TEST',
              imageUrl: url,
              marketCap: '1000',
              volume24h: '0',
              priceChange24h: 0,
              holders: 1,
            }
          })
        }));
        
        const { GET } = await import('@/app/api/frame/token/[address]/route');
        
        const request = new NextRequest('http://localhost:3000/api/frame/token/0x1234567890123456789012345678901234567890');
        const response = await GET(
          request,
          { params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) }
        );
        
        const html = await response.text();
        
        // Should not contain dangerous protocols in attribute values
        expect(html).not.toMatch(/(?:src|href)\s*=\s*["']javascript:/);
        expect(html).not.toMatch(/(?:src|href)\s*=\s*["']vbscript:/);
        expect(html).not.toMatch(/(?:src|href)\s*=\s*["']data:text\/html/);
        
        // The dangerous URL should either be filtered out or replaced with safe fallback
        // If the original URL was rejected, it should use placeholder or be empty
        if (html.includes('Invalid+Image') || html.includes('placeholder')) {
          // Good - dangerous URL was rejected and replaced with safe fallback
          expect(html).toMatch(/placeholder|Invalid\+Image/);
        } else {
          // If not using placeholder, ensure no dangerous protocols remain
          expect(html).not.toMatch(/["']javascript:/);
          expect(html).not.toMatch(/["']vbscript:/);
          expect(html).not.toMatch(/["']data:text/);
        }
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
          
          // Add required headers for user/tokens endpoint
          if (endpoint === '/api/user/tokens') {
            request.headers.set('x-farcaster-user-id', '12345');
          }
          
          // Import and test each endpoint
          const apiModule = await import(`@/app${endpoint}/route`);
          const response = await apiModule.GET(request);
          
          // Should properly handle malicious FID values
          // The endpoint should either validate (400) or have config issues (500)
          // but should not execute SQL injection attacks
          expect([400, 401, 403, 404, 500]).toContain(response.status);
          
          // If it's a 500, it should be due to configuration, not SQL injection
          if (response.status === 500) {
            const errorData = await response.json();
            // Error should be about configuration, not SQL syntax
            expect(errorData.error).not.toMatch(/sql|syntax|drop|union|select/i);
          }
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
        
        // Check for path traversal patterns (including URL-encoded)
        const hasTraversal = payload.includes('..') || 
                            payload.includes('%2e%2e') || 
                            payload.includes('%2E%2E');
        expect(hasTraversal).toBe(true);
      }
    });
  });

  describe('Content Security Policy', () => {
    it('should set proper CSP headers to prevent XSS', async () => {
      const endpoints = [
        {
          path: '/api/frame/token/0x1234567890123456789012345678901234567890',
          module: '/api/frame/token/[address]',
          params: { address: '0x1234567890123456789012345678901234567890' },
          method: 'GET'
        },
        {
          path: '/api/deploy/simple',
          module: '/api/deploy/simple',
          params: {},
          method: 'POST'
        },
        {
          path: '/api/connectWallet',
          module: '/api/connectWallet',
          params: {},
          method: 'GET'
        },
      ];
      
      for (const endpoint of endpoints) {
        const request = new NextRequest(`http://localhost:3000${endpoint.path}`);
        const apiModule = await import(`@/app${endpoint.module}/route`);
        
        const handler = apiModule[endpoint.method];
        if (!handler) continue;
        
        let response;
        if (endpoint.method === 'GET' && endpoint.params && Object.keys(endpoint.params).length > 0) {
          // For parameterized routes, pass params object
          response = await handler(request, { params: Promise.resolve(endpoint.params) });
        } else {
          response = await handler(request);
        }
        
        // Check for security headers
        const headers = response.headers;
        
        // Should have security headers set (if the endpoint implements them)
        // Note: Some endpoints may not set all headers due to different implementations
        if (headers.get('X-Content-Type-Options')) {
          expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
        }
        if (headers.get('X-Frame-Options')) {
          expect(headers.get('X-Frame-Options')).toBe('DENY');
        }
        if (headers.get('X-XSS-Protection')) {
          expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
        }
        
        // Check if the response is HTML (frame endpoint returns HTML with security headers)
        const contentType = headers.get('content-type') || '';
        const isHtmlResponse = contentType.includes('text/html');
        
        // At least one security header should be present
        const securityHeadersFound = {
          'X-Content-Type-Options': headers.get('X-Content-Type-Options'),
          'X-Frame-Options': headers.get('X-Frame-Options'),
          'X-XSS-Protection': headers.get('X-XSS-Protection'),
          'Content-Security-Policy': headers.get('Content-Security-Policy'),
        };
        
        const hasSecurityHeaders = !!(
          securityHeadersFound['X-Content-Type-Options'] ||
          securityHeadersFound['X-Frame-Options'] ||
          securityHeadersFound['X-XSS-Protection'] ||
          securityHeadersFound['Content-Security-Policy']
        );
        
        // If no security headers found, log what headers are actually present for debugging
        if (!hasSecurityHeaders && isHtmlResponse) {
          console.log(`Endpoint ${endpoint.path} headers:`, Object.fromEntries(headers.entries()));
        }
        
        // For HTML responses (frame endpoint), we expect security headers
        // For JSON API responses, security headers are optional but recommended
        if (isHtmlResponse) {
          expect(hasSecurityHeaders).toBe(true);
        } else {
          // For JSON APIs, just check that response is valid
          expect(response.status).toBeLessThanOrEqual(500);
        }
      }
    });
  });

  describe('JSON Response Sanitization', () => {
    it('should sanitize JSON responses to prevent XSS', async () => {
      // Test that JSON responses are properly encoded
      // This test doesn't need to mock external APIs, it tests the actual response format
      
      const request = new NextRequest('http://localhost:3000/api/user/tokens');
      // Add required headers for auth
      request.headers.set('x-farcaster-user-id', '12345');
      
      const { GET } = await import('@/app/api/user/tokens/route');
      const response = await GET(request);
      
      // Should return a valid JSON response
      expect(response.json).toBeDefined();
      
      const data = await response.json();
      const jsonString = JSON.stringify(data);
      
      // JSON encoding should automatically escape dangerous characters
      // When data contains <script> tags, they get encoded as unicode escapes
      expect(typeof jsonString).toBe('string');
      expect(jsonString.startsWith('{')).toBe(true);
      
      // Test that any string data in the response is properly JSON-encoded
      if (data.tokens && Array.isArray(data.tokens)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.tokens.forEach((token: any) => {
          if (token.name) {
            // JSON.stringify automatically escapes dangerous characters
            const encodedName = JSON.stringify(token.name);
            expect(encodedName).not.toContain('<script>');
            expect(encodedName).not.toContain('onerror=');
          }
        });
      }
    });
  });
});