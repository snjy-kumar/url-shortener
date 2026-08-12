/**
 * In-process process metrics for redirect hot path.
 * Single-node only — resets on restart; not shared across instances.
 */

const LATENCY_CAP = 512;

class ProcessMetrics {
  readonly startedAt = Date.now();
  redirects = 0;
  redirectHits = 0;
  redirectMisses = 0;
  redirectErrors = 0;
  rateLimit429 = 0;
  private latencyMs: number[] = [];
  private latencyWrite = 0;

  recordRedirect(durationMs: number, outcome: 'hit' | 'miss' | 'error'): void {
    this.redirects += 1;
    if (outcome === 'hit') {
      this.redirectHits += 1;
    } else if (outcome === 'miss') {
      this.redirectMisses += 1;
    } else {
      this.redirectErrors += 1;
    }

    const sample = Math.max(0, Math.round(durationMs));
    if (this.latencyMs.length < LATENCY_CAP) {
      this.latencyMs.push(sample);
    } else {
      this.latencyMs[this.latencyWrite % LATENCY_CAP] = sample;
      this.latencyWrite += 1;
    }
  }

  record429(): void {
    this.rateLimit429 += 1;
  }

  private percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) {
      return null;
    }
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return sorted[idx] ?? null;
  }

  snapshot() {
    const sorted = [...this.latencyMs].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, n) => acc + n, 0);
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      redirects: {
        total: this.redirects,
        hits: this.redirectHits,
        misses: this.redirectMisses,
        errors: this.redirectErrors,
      },
      rateLimit429: this.rateLimit429,
      redirectLatencyMs: {
        samples: sorted.length,
        avg: sorted.length ? Math.round(sum / sorted.length) : null,
        p50: this.percentile(sorted, 50),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99),
      },
    };
  }
}

export const metrics = new ProcessMetrics();
