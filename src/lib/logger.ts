import os from "os";
import path from "path";

const LOG_PATH = path.join(os.homedir(), ".sudo-habla.log");

let writeQueue = Promise.resolve();

const enqueueLog = (line: string) => {
  writeQueue = writeQueue
    .then(async () => {
      const nextLogState = new Blob([Bun.file(LOG_PATH), line]);
      await Bun.write(LOG_PATH, nextLogState);
    })
    .catch(() => {});
};

const formatLine = (level: "INFO" | "ERROR", message: string) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}\n`;
};

export const logInfo = (message: string) => {
  enqueueLog(formatLine("INFO", message));
};

export const logError = (message: string, error: unknown) => {
  const stackTrace = error instanceof Error ? (error.stack ?? error.message) : String(error);
  enqueueLog(formatLine("ERROR", `${message}\n${stackTrace}`));
};
