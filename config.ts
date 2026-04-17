import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".sudo-habla.json");

interface Config {
  apiKey: string;
}

export const readConfig = async (): Promise<Config | null> => {
  try {
    const file = Bun.file(CONFIG_PATH);
    const text = await file.text();
    if (!text) return null;
    return JSON.parse(text) as Config;
  } catch {
    return null;
  }
};

export const writeConfig = async (apiKey: string): Promise<void> => {
  const config: Config = { apiKey };
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
};

export const deleteConfig = (): void => {
  try {
    require("fs").unlinkSync(CONFIG_PATH);
  } catch {
    // File doesn't exist, ignore
  }
};
