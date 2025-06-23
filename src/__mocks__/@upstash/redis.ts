/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

export class Redis {
  private data = new Map<string, any>();
  private ttls = new Map<string, number>();

  constructor(config?: { url?: string; token?: string }) {
    // Mock constructor - config is intentionally unused
  }

  async get(key: string) {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any) {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: any) {
    this.data.set(key, value);
    this.ttls.set(key, seconds);
    return 'OK';
  }

  async hgetall(key: string) {
    return this.data.get(key) || null;
  }

  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
    return 1;
  }

  async ttl(key: string) {
    return this.ttls.get(key) || -1;
  }

  async incr(key: string) {
    const current = this.data.get(key);
    const newValue = current ? parseInt(current) + 1 : 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async del(key: string) {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  pipeline() {
    const operations: Array<{ method: string; args: any[] }> = [];
    
    return {
      get: (key: string) => {
        operations.push({ method: 'get', args: [key] });
      },
      ttl: (key: string) => {
        operations.push({ method: 'ttl', args: [key] });
      },
      exec: async () => {
        const results: any[] = [];
        for (const op of operations) {
          switch (op.method) {
            case 'get':
              results.push(this.data.get(op.args[0]) || null);
              break;
            case 'ttl':
              results.push(this.ttls.get(op.args[0]) || -1);
              break;
          }
        }
        return results;
      }
    };
  }
}