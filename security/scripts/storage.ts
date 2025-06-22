import { ScanReport } from './security-scanner';

export async function storeScanResult(report: ScanReport, redis: any): Promise<void> {
  const key = `security:scan:${report.scanId}`;
  const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
  
  await redis.set(key, JSON.stringify(report), { ex: ttl });
}

export async function getScanResult(scanId: string, redis: any): Promise<ScanReport | null> {
  const key = `security:scan:${scanId}`;
  const data = await redis.get(key);
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as ScanReport;
  } catch (error) {
    console.error('Failed to parse scan result:', error);
    return null;
  }
}

export async function listRecentScans(limit: number, redis: any): Promise<ScanReport[]> {
  const keys = await redis.keys('security:scan:*');
  const reports: ScanReport[] = [];
  
  // Sort keys by scan ID (which includes timestamp)
  const sortedKeys = keys.sort().reverse().slice(0, limit);
  
  for (const key of sortedKeys) {
    const data = await redis.get(key);
    if (data) {
      try {
        const report = JSON.parse(data) as ScanReport;
        reports.push(report);
      } catch (error) {
        console.error(`Failed to parse scan result for key ${key}:`, error);
      }
    }
  }
  
  // Sort by timestamp
  return reports.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function deleteScanResult(scanId: string, redis: any): Promise<boolean> {
  const key = `security:scan:${scanId}`;
  const result = await redis.del(key);
  return result === 1;
}

export async function getScanStatistics(redis: any): Promise<{
  totalScans: number;
  recentScans: number;
  oldestScan?: Date;
  newestScan?: Date;
}> {
  const keys = await redis.keys('security:scan:*');
  const stats = {
    totalScans: keys.length,
    recentScans: 0,
    oldestScan: undefined as Date | undefined,
    newestScan: undefined as Date | undefined,
  };
  
  if (keys.length === 0) {
    return stats;
  }
  
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  let oldestTimestamp: Date | null = null;
  let newestTimestamp: Date | null = null;
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      try {
        const report = JSON.parse(data) as ScanReport;
        const timestamp = new Date(report.timestamp);
        
        if (timestamp > oneDayAgo) {
          stats.recentScans++;
        }
        
        if (!oldestTimestamp || timestamp < oldestTimestamp) {
          oldestTimestamp = timestamp;
        }
        
        if (!newestTimestamp || timestamp > newestTimestamp) {
          newestTimestamp = timestamp;
        }
      } catch (error) {
        // Skip corrupted data
      }
    }
  }
  
  stats.oldestScan = oldestTimestamp || undefined;
  stats.newestScan = newestTimestamp || undefined;
  
  return stats;
}