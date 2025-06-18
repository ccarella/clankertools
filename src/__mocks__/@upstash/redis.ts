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
}