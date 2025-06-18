import { parseCastContext, formatCastUrl, extractCastId } from '../cast-context';
import { LaunchContext } from '../types/cast-context';

describe('Cast Context Utilities', () => {
  describe('parseCastContext', () => {
    it('should parse valid cast context', () => {
      const context: LaunchContext = {
        type: 'cast',
        castId: '0x1234567890abcdef',
        parentCastId: '0x0987654321fedcba',
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User',
          pfpUrl: 'https://example.com/pfp.png'
        },
        embedUrl: 'https://example.com/frame'
      };

      const result = parseCastContext(context);

      expect(result).toEqual({
        type: 'cast',
        castId: '0x1234567890abcdef',
        parentCastId: '0x0987654321fedcba',
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User',
          pfpUrl: 'https://example.com/pfp.png'
        },
        embedUrl: 'https://example.com/frame'
      });
    });

    it('should handle context without parent cast', () => {
      const context: LaunchContext = {
        type: 'cast',
        castId: '0x1234567890abcdef',
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User'
        }
      };

      const result = parseCastContext(context);

      expect(result).toEqual({
        type: 'cast',
        castId: '0x1234567890abcdef',
        parentCastId: undefined,
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User',
          pfpUrl: undefined
        },
        embedUrl: undefined
      });
    });

    it('should handle notification context', () => {
      const context: LaunchContext = {
        type: 'notification'
      };

      const result = parseCastContext(context);

      expect(result).toBeNull();
    });

    it('should handle direct message context', () => {
      const context: LaunchContext = {
        type: 'direct'
      };

      const result = parseCastContext(context);

      expect(result).toBeNull();
    });

    it('should handle null context', () => {
      const result = parseCastContext(null);
      expect(result).toBeNull();
    });

    it('should handle undefined context', () => {
      const result = parseCastContext(undefined);
      expect(result).toBeNull();
    });
  });

  describe('formatCastUrl', () => {
    it('should format cast URL with hash', () => {
      const castId = '0x1234567890abcdef';
      const url = formatCastUrl(castId);
      expect(url).toBe('https://warpcast.com/~/conversations/0x1234567890abcdef');
    });

    it('should format cast URL with author and hash', () => {
      const castId = '0x1234567890abcdef';
      const author = 'testuser';
      const url = formatCastUrl(castId, author);
      expect(url).toBe('https://warpcast.com/testuser/0x1234567890abcdef');
    });

    it('should handle empty cast ID', () => {
      const url = formatCastUrl('');
      expect(url).toBe('');
    });

    it('should handle null cast ID', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = formatCastUrl(null as any);
      expect(url).toBe('');
    });
  });

  describe('extractCastId', () => {
    it('should extract cast ID from URL with hash', () => {
      const url = 'https://warpcast.com/~/conversations/0x1234567890abcdef';
      const castId = extractCastId(url);
      expect(castId).toBe('0x1234567890abcdef');
    });

    it('should extract cast ID from URL with author', () => {
      const url = 'https://warpcast.com/testuser/0x1234567890abcdef';
      const castId = extractCastId(url);
      expect(castId).toBe('0x1234567890abcdef');
    });

    it('should handle invalid URL', () => {
      const url = 'https://example.com/invalid';
      const castId = extractCastId(url);
      expect(castId).toBeNull();
    });

    it('should handle non-warpcast URL', () => {
      const url = 'https://other.com/testuser/0x1234567890abcdef';
      const castId = extractCastId(url);
      expect(castId).toBeNull();
    });

    it('should handle empty URL', () => {
      const castId = extractCastId('');
      expect(castId).toBeNull();
    });
  });
});