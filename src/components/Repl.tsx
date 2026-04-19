import React, { useMemo, useState } from "react";
import { Box, Spacer, Text } from "ink";
import TextInput from "ink-text-input";
import { marked } from "marked";
// @ts-ignore - marked-terminal lacks TypeScript definitions
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { deleteConfig, type Config } from "../lib/config";
import { getLatestGitDiff } from "../lib/git";
import { addVocab } from "../lib/vocab";
import { buildRoastPrompt, SYSTEM_PROMPT } from "../prompts/system";

marked.use(
  markedTerminal({
    code: chalk.yellow,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue,
    href: chalk.blue.underline,
    width: 80,
    reflowText: false,
    emoji: true,
    tab: 2,
  }),
);

const Markdown = ({ children }: { children: string }) => {
  const rendered = useMemo(() => {
    if (!children) return "";
    try {
      return marked.parse(children, { async: false }) as string;
    } catch {
      return children;
    }
  }, [children]);

  const lines = rendered.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Text key={`line-${i}-${line.length}`}>{line || " "}</Text>
      ))}
    </>
  );
};

interface ReplProps {
  config: Config;
  onConfigReset: () => void;
}

export const Repl = ({ config, onConfigReset }: ReplProps) => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState("");

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;
    if (query === "/exit") process.exit(0);

    if (query === "/config") {
      deleteConfig();
      setOutput("🔑 Config cleared. Configure a new one below.");
      onConfigReset();
      return;
    }

    const providerApiKey = config.apiKeys[config.activeProvider];

    if (!providerApiKey) {
      setOutput(`Error: No ${config.activeProvider} API key configured. Run /config to set one up.`);
      return;
    }

    setInput("");
    setOutput("");
    setIsStreaming(true);

    try {
      let userContent: string;

      if (query === "/roast") {
        const gitData = await getLatestGitDiff();
        userContent = buildRoastPrompt(gitData);
      } else {
        userContent = query;
      }

      const model =
        config.activeProvider === "gemini"
          ? createGoogleGenerativeAI({ apiKey: config.apiKeys.gemini })(config.activeModel)
          : createOpenAI({
              apiKey: config.apiKeys.openai,
              baseURL: process.env.BASE_URL,
            })(config.activeModel);

      const { textStream } = await streamText({
        model,
        system: SYSTEM_PROMPT,
        prompt: userContent,
      });

      let fullText = "";
      for await (const textPart of textStream) {
        fullText += textPart;
        const visibleText = fullText.split("|||VOCAB|||")[0] ?? "";
        setOutput(visibleText);
      }

      try {
        const vocabMatch = fullText.match(/\|\|\|VOCAB\|\|\|\s*([\s\S]*?)\s*\|\|\|END_VOCAB\|\|\|/);
        if (vocabMatch?.[1]) {
          const parsed = JSON.parse(vocabMatch[1]) as { word: string; translation: string }[];
          if (Array.isArray(parsed)) {
            await addVocab(parsed);
          }
        }
      } catch {
        // Ignore malformed vocab blocks from model responses
      }
    } catch (error: any) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box marginBottom={1}>
        <Text color="red" bold>
          🦈 sudo-habla v0.1
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {output && (
          <Box
            marginBottom={1}
            borderStyle="round"
            borderColor="red"
            paddingX={1}
            flexDirection="column"
          >
            <Markdown>{output}</Markdown>
          </Box>
        )}
        <Spacer />
      </Box>

      <Box marginTop={1}>
        <Box marginRight={1}>
          <Text color="red">❯</Text>
        </Box>
        {isStreaming ? (
          <Text color="red">El senior está escribiendo...</Text>
        ) : (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="/lore, /roast, /meaning <word>, /config, /exit"
          />
        )}
      </Box>
    </Box>
  );
};
