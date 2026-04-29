import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Config } from "./config";
import { addVocab } from "./vocab";
import { logError, logInfo } from "./logger";
import { SYSTEM_PROMPT } from "../prompts/system";
import { buildMissingApiKeyMessage } from "../prompts/messages";

export const streamAssistantResponse = async ({
  config,
  prompt,
  system = SYSTEM_PROMPT,
  onText,
}: {
  config: Config;
  prompt: string;
  system?: string;
  onText: (visibleText: string) => void;
}) => {
  const providerApiKey = config.apiKeys[config.activeProvider];

  if (!providerApiKey) {
    throw new Error(buildMissingApiKeyMessage(config.activeProvider));
  }

  const model =
    config.activeProvider === "gemini"
      ? createGoogleGenerativeAI({ apiKey: providerApiKey })(config.activeModel)
      : createOpenAI({
          apiKey: providerApiKey,
          baseURL: process.env.BASE_URL,
        })(config.activeModel);

  const startedAt = Date.now();
  logInfo(
    `Request started provider=${config.activeProvider} model=${config.activeModel}`,
  );

  try {
    const { textStream } = await streamText({
      model,
      system,
      prompt,
    });

    let fullText = "";
    for await (const textPart of textStream) {
      fullText += textPart;
      const visibleText = fullText.split("|||VOCAB|||")[0] ?? "";
      onText(visibleText);
    }

    const visibleText = fullText.split("|||VOCAB|||")[0] ?? "";

    try {
      const vocabMatch = fullText.match(
        /\|\|\|VOCAB\|\|\|\s*([\s\S]*?)\s*\|\|\|END_VOCAB\|\|\|/,
      );
      if (vocabMatch?.[1]) {
        const parsed = JSON.parse(vocabMatch[1]) as {
          word: string;
          translation: string;
        }[];
        if (Array.isArray(parsed)) {
          await addVocab(parsed);
        }
      }
    } catch {
      // Ignore malformed vocab blocks from model responses
    }

    logInfo(`Stream completed successfully durationMs=${Date.now() - startedAt}`);
    return visibleText;
  } catch (error) {
    logError("Stream failed", error);
    throw error;
  }
};
