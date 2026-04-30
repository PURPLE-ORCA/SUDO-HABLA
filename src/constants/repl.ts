export const CMD_ROAST = "/roast";
export const CMD_LORE = "/lore";
export const CMD_DAILY_PREFIX = "/daily ";
export const CMD_REVISAR_PREFIX = "/revisar ";
export const CMD_COMMENT_PREFIX = "/comment @";
export const CMD_EXPLORE_PREFIX = "/explore ";
export const CMD_BLAME_PREFIX = "/blame ";
export const CMD_ENTREVISTA = "/entrevista";
export const CMD_MEANING_PREFIX = "/meaning ";
export const CMD_QUIZ = "/quiz";
export const CMD_COMMIT = "/commit";
export const CMD_PR = "/pr";
export const CMD_CLEAR = "/clear";
export const CMD_CONFIG = "/config";
export const CMD_EXIT = "/exit";

export const REPL_COMMANDS = [
  { label: "/roast - Roast your git diff", value: CMD_ROAST },
  { label: "/commit - Generate a Spanish commit message from your diff", value: CMD_COMMIT },
  { label: "/lore - Get a random cynical dev story", value: CMD_LORE },
  { label: "/daily <update> - Give your standup update", value: CMD_DAILY_PREFIX },
  { label: "/revisar <filepath> - Roast a specific file", value: CMD_REVISAR_PREFIX },
  { label: "/comment @filepath - Generate a structured usage docblock for a file", value: "/comment " },
  { label: "/explore <template> - Generate project docs based on a template", value: CMD_EXPLORE_PREFIX },
  { label: "/blame <filepath> - Blame exact coworker for file", value: CMD_BLAME_PREFIX },
  { label: "/entrevista - Start a technical interview", value: CMD_ENTREVISTA },
  { label: "/meaning <word> - Translate and explain a term", value: CMD_MEANING_PREFIX },
  { label: "/quiz - Test your vocab mastery", value: CMD_QUIZ },
  { label: "/pr - Generate a PR description from your branch", value: CMD_PR },
  { label: "/clear - Wipe chat history", value: CMD_CLEAR },
  { label: "/config - Change provider/model", value: CMD_CONFIG },
  { label: "/exit - Quit the application", value: CMD_EXIT },
];

export const INTERVIEW_QUESTIONS = [
  "¿Cuál es la diferencia entre una promesa y un callback?",
  "Explícame qué es el DOM virtual en React.",
  "¿Por qué usarías Docker en un proyecto nuevo?",
  "¿Qué es la inyección de SQL y cómo la previenes?",
  "¿Cómo funciona el Event Loop en Node.js o JavaScript?",
];
