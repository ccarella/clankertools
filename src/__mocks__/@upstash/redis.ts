/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

export class Redis {
  private data = new Map<string, any>();

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
    // Note: seconds parameter is intentionally ignored in mock
    return 'OK';
  }

  async hgetall(key: string) {
    return this.data.get(key) || null;
  }

  async expire(key: string, seconds: number) {
    // Note: key and seconds parameters are intentionally ignored in mock
    return 1;
  }

  async del(key: string) {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async zadd(key: string, options: { score: number; member: string } | Array<{ score: number; member: string }>) {
    const items = Array.isArray(options) ? options : [options];
    let added = 0;
    
    const existing = this.data.get(key) || [];
    for (const item of items) {
      const index = existing.findIndex((e: any) => e.member === item.member);
      if (index === -1) {
        existing.push(item);
        added++;
      } else {
        existing[index] = item;
      }
    }
    
    existing.sort((a: any, b: any) => a.score - b.score);
    this.data.set(key, existing);
    return added;
  }

  async zrevrange(key: string, start: number, stop: number) {
    const items = this.data.get(key) || [];
    const sorted = [...items].sort((a: any, b: any) => b.score - a.score);
    return sorted.slice(start, stop + 1).map((item: any) => item.member);
  }

  async zrem(key: string, member: string) {
    const items = this.data.get(key) || [];
    const initialLength = items.length;
    const filtered = items.filter((item: any) => item.member !== member);
    this.data.set(key, filtered);
    return initialLength - filtered.length;
  }
}