import os from "os";
import path from "path";
import type { Message } from "../components/repl/types";

const HISTORY_PATH = path.join(os.homedir(), ".sudo-habla-history.json");

const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.text === "string"
  );
};

export const loadHistory = async (): Promise<Message[]> => {
  try {
    const text = await Bun.file(HISTORY_PATH).text();
    if (!text.trim()) return [];

    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isMessage);
  } catch {
    return [];
  }
};

export const saveHistory = async (messages: Message[]): Promise<void> => {
  await Bun.write(HISTORY_PATH, JSON.stringify(messages, null, 2));
};

export const clearHistory = async (): Promise<void> => {
  await Bun.write(HISTORY_PATH, "[]");
};
