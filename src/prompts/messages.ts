export const buildMissingApiKeyMessage = (provider: string): string =>
  `No ${provider} API key configured. Run /config to set one up.`;

export const buildGenericErrorMessage = (message: string): string =>
  `Error: ${message}`;

export const buildQuizRequiresWordsMessage = (
  roastCommand: string,
  meaningCommand: string,
): string =>
  `You need at least 4 words in your Cheat Sheet to take a quiz. Run ${roastCommand} or ${meaningCommand} first.`;

export const CONFIG_CLEARED_MESSAGE =
  "🔑 Config cleared. Configure a new one below.";

export const buildInterviewHeaderMessage = (question: string): string =>
  `👔 **ENTREVISTA TÉCNICA:**\n${question}`;

export const buildDailyUsageMessage = (dailyCommand: string): string =>
  `You have to actually give an update, junior. Usage: ${dailyCommand} <your update in English>`;

export const buildRevisarUsageMessage = (revisarCommand: string): string =>
  `I need a file path to roast, junior. Usage: ${revisarCommand} <src/file.ts>`;

export const buildMissingFileMessage = (filePath: string): string =>
  `404 Brain Not Found. The file "${filePath}" does not exist in this directory.`;

export const buildFileReadErrorMessage = (error: unknown): string =>
  `I couldn't read the file. Probably a permissions issue, just like your database. Error: ${error}`;

export const POP_QUIZ_TITLE_PREFIX = '🧠 Pop Quiz: What does "';
export const POP_QUIZ_TITLE_SUFFIX = '" mean?';
export const INPUT_PLACEHOLDER_INTERVIEW = "Type your answer in Spanish...";
export const INPUT_PLACEHOLDER_DEFAULT =
  "Type / for commands or ask a question...";
export const CHEAT_SHEET_TITLE = "Cheat Sheet";
export const NO_VOCAB_MESSAGE = "No vocab yet. Get roasted.";
export const TAB_COMPLETE_HINT = " [Tab to complete]";
