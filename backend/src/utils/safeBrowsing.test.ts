import { describe, expect, it } from 'vitest';
import { assertUrlNotMalicious } from './safeBrowsing.js';

describe('assertUrlNotMalicious', () => {
  it('no-ops when SAFE_BROWSING_API_KEY unset', async () => {
    await expect(
      assertUrlNotMalicious('https://example.com/ok')
    ).resolves.toBeUndefined();
  });
});
