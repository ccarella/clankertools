export class Redis {
  private data = new Map<string, any>();

  constructor(config?: { url?: string; token?: string }) {
    // Mock constructor
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
    return 'OK';
  }

  async hgetall(key: string) {
    return this.data.get(key) || null;
  }

  async expire(key: string, seconds: number) {
    return 1;
  }
}