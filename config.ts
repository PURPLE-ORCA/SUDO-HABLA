import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".sudo-habla.json");

export type Provider = "gemini" | "openai";

export interface Config {
  activeProvider: Provider;
  apiKeys: Record<Provider, string>;
}

export const readConfig = async (): Promise<Config | null> => {
  try {
    const file = Bun.file(CONFIG_PATH);
    const text = await file.text();
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<Config> & { apiKey?: string };

    if (parsed.activeProvider && parsed.apiKeys) {
      return parsed as Config;
    }

    if (typeof parsed.apiKey === "string" && parsed.apiKey) {
      return {
        activeProvider: "openai",
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
  apiKey: string,
): Promise<void> => {
  const config: Config = {
    activeProvider,
    apiKeys: {
      gemini: activeProvider === "gemini" ? apiKey : "",
      openai: activeProvider === "openai" ? apiKey : "",
    },
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
