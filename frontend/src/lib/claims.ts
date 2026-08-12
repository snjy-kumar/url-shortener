const CLAIMS_KEY = "shortlink.claims";

type ClaimMap = Record<string, string>;

const read = (): ClaimMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CLAIMS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ClaimMap;
  } catch {
    return {};
  }
};

const write = (map: ClaimMap) => {
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(map));
};

export const saveClaimToken = (shortCode: string, claimToken: string) => {
  const map = read();
  map[shortCode.toLowerCase()] = claimToken;
  write(map);
};

export const getClaimToken = (shortCode: string): string | null => {
  const map = read();
  return map[shortCode.toLowerCase()] ?? null;
};

export const listPendingClaims = (): Array<{
  shortCode: string;
  claimToken: string;
}> =>
  Object.entries(read()).map(([shortCode, claimToken]) => ({
    shortCode,
    claimToken,
  }));

export const clearClaimToken = (shortCode: string) => {
  const map = read();
  delete map[shortCode.toLowerCase()];
  write(map);
};
