const STORAGE_KEY = "shortlink.recentCodes";
const MAX_RECENT = 30;

export function readRecentCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeRecentCodes(codes: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes.slice(0, MAX_RECENT)));
}

/** Put code at front of recent list. */
export function rememberCode(shortCode: string) {
  const code = shortCode.trim().toLowerCase();
  if (!code) return;
  const next = [code, ...readRecentCodes().filter((c) => c !== code)];
  writeRecentCodes(next);
}

export function forgetCode(shortCode: string) {
  const code = shortCode.trim().toLowerCase();
  writeRecentCodes(readRecentCodes().filter((c) => c !== code));
}

export function renameRememberedCode(from: string, to: string) {
  const oldCode = from.trim().toLowerCase();
  const newCode = to.trim().toLowerCase();
  if (!oldCode || !newCode || oldCode === newCode) {
    rememberCode(newCode || oldCode);
    return;
  }
  const rest = readRecentCodes().filter((c) => c !== oldCode && c !== newCode);
  writeRecentCodes([newCode, ...rest]);
}
