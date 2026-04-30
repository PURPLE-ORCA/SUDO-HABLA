import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".sudo-habla.json");

export type Provider = "gemini" | "openai";

export interface UpdateCheck {
  timestamp: number;
  version: string | null;
}

export interface Config {
  activeProvider: Provider;
  activeModel: string;
  apiKeys: Record<Provider, string>;
  lastUpdateCheck?: UpdateCheck;
}

export const readConfig = async (): Promise<Config | null> => {
  try {
    const file = Bun.file(CONFIG_PATH);
    const text = await file.text();
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<Config> & { apiKey?: string };

    if (parsed.activeProvider && parsed.apiKeys) {
      return {
        activeProvider: parsed.activeProvider,
        activeModel:
          parsed.activeModel ||
          (parsed.activeProvider === "gemini" ? "gemini-2.5-flash" : "gpt-3.5-turbo"),
        apiKeys: {
          gemini: parsed.apiKeys.gemini ?? "",
          openai: parsed.apiKeys.openai ?? "",
        },
        lastUpdateCheck: parsed.lastUpdateCheck,
      };
    }

    if (typeof parsed.apiKey === "string" && parsed.apiKey) {
      return {
        activeProvider: "openai",
        activeModel: "gpt-3.5-turbo",
        apiKeys: {
          gemini: "",
          openai: parsed.apiKey,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const writeConfig = async (
  activeProvider: Provider,
  activeModel: string,
  apiKey: string,
  lastUpdateCheck?: UpdateCheck,
): Promise<void> => {
  const config: Config = {
    activeProvider,
    activeModel,
    apiKeys: {
      gemini: activeProvider === "gemini" ? apiKey : "",
      openai: activeProvider === "openai" ? apiKey : "",
    },
    lastUpdateCheck,
  };

  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
};

export const deleteConfig = (): void => {
  try {
    require("fs").unlinkSync(CONFIG_PATH);
  } catch {
    // File doesn't exist, ignore
  }
};
