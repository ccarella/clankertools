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
    return this.data.get(key) || {};
  }

  async hset(key: string, field: string | Record<string, any>, value?: any) {
    let hash = this.data.get(key) || {};
    
    if (typeof field === 'string' && value !== undefined) {
      // Single field-value pair
      hash[field] = value;
    } else if (typeof field === 'object') {
      // Multiple field-value pairs
      hash = { ...hash, ...field };
    }
    
    this.data.set(key, hash);
    return 1;
  }

  async hdel(key: string, field: string) {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object' && field in hash) {
      delete hash[field];
      this.data.set(key, hash);
      return 1;
    }
    return 0;
  }

  async lpush(key: string, ...values: any[]) {
    const list = this.data.get(key) || [];
    list.unshift(...values);
    this.data.set(key, list);
    return list.length;
  }

  async rpop(key: string) {
    const list = this.data.get(key);
    if (Array.isArray(list) && list.length > 0) {
      const value = list.pop();
      this.data.set(key, list);
      return value;
    }
    return null;
  }

  async lrem(key: string, count: number, value: any) {
    const list = this.data.get(key);
    if (!Array.isArray(list)) return 0;

    let removed = 0;
    const newList = [...list];
    
    if (count === 0) {
      // Remove all occurrences
      for (let i = newList.length - 1; i >= 0; i--) {
        if (newList[i] === value) {
          newList.splice(i, 1);
          removed++;
        }
      }
    } else if (count > 0) {
      // Remove from head
      for (let i = 0; i < newList.length && removed < count; i++) {
        if (newList[i] === value) {
          newList.splice(i, 1);
          removed++;
          i--; // Adjust index after removal
        }
      }
    } else {
      // Remove from tail
      const absCount = Math.abs(count);
      for (let i = newList.length - 1; i >= 0 && removed < absCount; i--) {
        if (newList[i] === value) {
          newList.splice(i, 1);
          removed++;
        }
      }
    }

    this.data.set(key, newList);
    return removed;
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.data.get(key);
    if (!Array.isArray(list)) return [];

    const length = list.length;
    const startIndex = start < 0 ? Math.max(0, length + start) : start;
    let stopIndex = stop < 0 ? length + stop : stop;

    if (stopIndex >= length) stopIndex = length - 1;
    if (startIndex > stopIndex) return [];

    return list.slice(startIndex, stopIndex + 1);
  }

  async publish(channel: string, message: string) {
    // Mock publish - just return 0 (no subscribers)
    return 0;
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    // Mock subscribe - just store the callback
    return;
  }

  async unsubscribe(channel: string) {
    // Mock unsubscribe
    return;
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