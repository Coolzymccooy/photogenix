
export interface PerformanceMetric {
  id: string;
  operation: string;
  durationMs: number;
  timestamp: number;
  itemCount: number;
}

const STORAGE_KEY_METRICS = 'photogenix_performance_metrics';

export const Analytics = {
  logEvent: (eventName: string, data: any = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventName,
      data,
    };
    console.debug(`[Analytics] ${eventName}`, logEntry);
  },

  trackPerformance: (operation: string, durationMs: number, itemCount: number = 1) => {
    const metric: PerformanceMetric = {
      id: Math.random().toString(36).substr(2, 9),
      operation,
      durationMs,
      timestamp: Date.now(),
      itemCount
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_METRICS) || '[]');
      existing.push(metric);
      if (existing.length > 20) existing.shift();
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(existing));
    } catch (e) {
      console.warn("Metrics storage failed", e);
    }
    
    Analytics.logEvent('perf_metric', metric);
    return metric;
  },

  getAverageLoadTime: () => {
    const metrics: PerformanceMetric[] = JSON.parse(localStorage.getItem(STORAGE_KEY_METRICS) || '[]');
    if (metrics.length === 0) return 0;
    const loads = metrics.filter(m => m.operation === 'bulk_ingest');
    if (loads.length === 0) return 0;
    return Math.round(loads.reduce((acc, m) => acc + (m.durationMs / m.itemCount), 0) / loads.length);
  },

  initSession: (user: any) => {
    Analytics.logEvent('session_start', { user: user.email });
  }
};
