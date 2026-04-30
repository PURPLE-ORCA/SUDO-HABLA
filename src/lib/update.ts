import os from "os";
import path from "path";
import { readConfig, writeConfig, type Config } from "./config";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/sudo-habla/latest";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function parseSemver(version: string): [number, number, number] {
  const clean = version.replace(/^v/, "");
  const [major, minor, patch] = clean.split(".").map((n) => parseInt(n, 10));
  return [major || 0, minor || 0, patch || 0];
}

function isNewer(remote: string, local: string): boolean {
  const [rMajor, rMinor, rPatch] = parseSemver(remote);
  const [lMajor, lMinor, lPatch] = parseSemver(local);
  if (rMajor !== lMajor) return rMajor > lMajor;
  if (rMinor !== lMinor) return rMinor > lMinor;
  return rPatch > lPatch;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(NPM_REGISTRY_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function checkForUpdates(
  localVersion: string,
): Promise<string | null> {
  const config = await readConfig();

  // Use cached result if within TTL
  if (config?.lastUpdateCheck) {
    const age = Date.now() - config.lastUpdateCheck.timestamp;
    if (age < TTL_MS) {
      const cached = config.lastUpdateCheck.version;
      if (cached && isNewer(cached, localVersion)) {
        return cached;
      }
      return null;
    }
  }

  // Fetch fresh
  const latest = await fetchLatestVersion();

  // Persist cache (best-effort, never block on failure)
  if (config) {
    const updated: Config = {
      ...config,
      lastUpdateCheck: {
        timestamp: Date.now(),
        version: latest,
      },
    };
    try {
      await writeConfig(
        updated.activeProvider,
        updated.activeModel,
        updated.apiKeys[updated.activeProvider] || "",
        updated.lastUpdateCheck,
      );
    } catch {
      // Ignore write failures — cache is a nice-to-have
    }
  }

  if (latest && isNewer(latest, localVersion)) {
    return latest;
  }

  return null;
}
