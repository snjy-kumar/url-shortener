/** Optional Google Safe Browsing v4 check on create.
 * Skipped when SAFE_BROWSING_API_KEY unset.
 */
import { config } from '../config/env.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

type ThreatMatch = {
  threatType?: string;
  platformType?: string;
};

type LookupResponse = {
  matches?: ThreatMatch[];
};

export const assertUrlNotMalicious = async (url: string): Promise<void> => {
  const key = config.SAFE_BROWSING_API_KEY;
  if (!key) {
    return;
  }

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: {
          clientId: 'shortlink',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
  } catch (error) {
    logger.warn('Safe Browsing request failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    if (config.SAFE_BROWSING_FAIL_CLOSED) {
      throw new AppError('URL safety check unavailable', 503);
    }
    return;
  }

  if (!res.ok) {
    logger.warn('Safe Browsing HTTP error', { status: res.status });
    if (config.SAFE_BROWSING_FAIL_CLOSED) {
      throw new AppError('URL safety check unavailable', 503);
    }
    return;
  }

  const json = (await res.json()) as LookupResponse;
  if (json.matches && json.matches.length > 0) {
    const types = json.matches
      .map((m) => m.threatType)
      .filter(Boolean)
      .join(', ');
    throw new AppError(
      `URL blocked by safety check${types ? ` (${types})` : ''}`,
      400
    );
  }
};
