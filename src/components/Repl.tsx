import React, { useEffect, useMemo, useState } from "react";
import { Box, Spacer, Text, useInput, useStdout } from "ink";
import SelectInput from "ink-select-input";
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
import {
  addVocab,
  getVocab,
  type VocabEntry,
  updateMastery,
} from "../lib/vocab";
import {
  CMD_CONFIG,
  CMD_DAILY_PREFIX,
  CMD_ENTREVISTA,
  CMD_EXIT,
  CMD_MEANING_PREFIX,
  CMD_QUIZ,
  CMD_REVISAR_PREFIX,
  CMD_ROAST,
  INTERVIEW_QUESTIONS,
  REPL_COMMANDS,
} from "../constants/repl";
import { CLI_BRAND_COLOR, INPUT_BACKGROUND_COLOR } from "../constants/ui";
import {
  buildRoastPrompt,
  DAILY_PROMPT_INJECT,
  REVISAR_PROMPT_INJECT,
  SYSTEM_PROMPT,
} from "../prompts/system";
import {
  buildInterviewEvaluationPrompt,
  buildQuizFeedbackPrompt,
} from "../prompts/repl";
import packageJson from "../../package.json";

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

type Message = { role: "user" | "assistant"; text: string };

const getMasteryColor = (mastery = 0) => {
  if (mastery === 0) return "red";
  if (mastery <= 2) return "yellow";
  return "green";
};

export const Repl = ({ config, onConfigReset }: ReplProps) => {
  const [input, setInput] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentStream, setCurrentStream] = useState("");
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [quiz, setQuiz] = useState<{
    active: boolean;
    target?: VocabEntry;
    options?: { label: string; value: string }[];
  }>({ active: false });
  const [interviewQuestion, setInterviewQuestion] = useState<string | null>(
    null,
  );

  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns,
    rows: stdout.rows,
  });

  useEffect(() => {
    const onResize = () =>
      setDimensions({ columns: stdout.columns, rows: stdout.rows });
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  useEffect(() => {
    const loadVocab = async () => {
      const vocab = await getVocab();
      setVocabList(vocab);
    };

    loadVocab();
  }, []);

  const shuffle = <T,>(items: T[]): T[] => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const current = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = current;
    }
    return shuffled;
  };

  const streamAssistantResponse = async (prompt: string) => {
    const providerApiKey = config.apiKeys[config.activeProvider];

    if (!providerApiKey) {
      throw new Error(
        `No ${config.activeProvider} API key configured. Run /config to set one up.`,
      );
    }

    const model =
      config.activeProvider === "gemini"
        ? createGoogleGenerativeAI({ apiKey: providerApiKey })(
            config.activeModel,
          )
        : createOpenAI({
            apiKey: providerApiKey,
            baseURL: process.env.BASE_URL,
          })(config.activeModel);

    const { textStream } = await streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt,
    });

    let fullText = "";
    for await (const textPart of textStream) {
      fullText += textPart;
      const visibleText = fullText.split("|||VOCAB|||")[0] ?? "";
      setCurrentStream(visibleText);
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

    setHistory((prev) => [...prev, { role: "assistant", text: visibleText }]);
    setCurrentStream("");
    const refreshedVocab = await getVocab();
    setVocabList(refreshedVocab);
  };

  const isTypingCommand = input.startsWith("/") && !input.includes(" ");
  const filteredCommands = REPL_COMMANDS.filter((c) =>
    c.value.startsWith(input),
  );
  const isExactCommandMatch = REPL_COMMANDS.some((c) => c.value === input);
  const showMenu =
    isTypingCommand && filteredCommands.length > 0 && !isExactCommandMatch;

  useInput(
    (char, key) => {
      // 1. Toggle Sidebar (Always active)
      if (key.ctrl && char === "b") {
        setShowSidebar((prev) => !prev);
      }

      // 2. Tab Autocomplete (Only active if menu is showing)
      if (key.tab && showMenu && filteredCommands.length > 0) {
        const match = filteredCommands[0]!.value;
        setInput(match.endsWith(" ") ? match : match + " ");
        setInputKey((prev) => prev + 1);
      }
    },
    { isActive: true },
  ); // CRITICAL: This must be true so Ctrl+B always works

  const handleQuizSubmit = async (item: { value: string }) => {
    if (!quiz.active || !quiz.target) return;

    const target = quiz.target;
    const guess = item.value;
    const isCorrect = guess === target.translation;

    setQuiz({ active: false });
    setIsStreaming(true);

    try {
      await updateMastery(target.word, isCorrect);
      const refreshedVocab = await getVocab();
      setVocabList(refreshedVocab);

      const hiddenPrompt = buildQuizFeedbackPrompt(
        target.word,
        guess,
        isCorrect,
      );

      await streamAssistantResponse(hiddenPrompt);
    } catch (error: any) {
      setHistory((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${error.message}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (query: string) => {
    if (query.trim() === CMD_QUIZ) {
      if (vocabList.length < 4) {
        setHistory((prev) => [
          ...prev,
          { role: "user", text: CMD_QUIZ },
          {
            role: "assistant",
            text: `You need at least 4 words in your Cheat Sheet to take a quiz. Run ${CMD_ROAST} or ${CMD_MEANING_PREFIX.trim()} first.`,
          },
        ]);
        return; // Stop execution
      }

      // 1. Pick a random target word
      const targetIndex = Math.floor(Math.random() * vocabList.length);
      const target = vocabList[targetIndex]!;

      // 2. Pick 3 unique distractors
      const distractors = vocabList
        .filter((v) => v.word !== target.word)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      // 3. Combine and shuffle the options for the UI
      const options = [target, ...distractors]
        .map((v) => ({ label: v.translation, value: v.translation }))
        .sort(() => 0.5 - Math.random());

      // 4. Trigger the UI state
      setQuiz({ active: true, target, options });

      // CRITICAL: Return immediately so we don't call the LLM API
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;
    if (query === CMD_EXIT) process.exit(0);

    if (query === CMD_CONFIG) {
      deleteConfig();
      setHistory((prev) => [
        ...prev,
        { role: "user", text: CMD_CONFIG },
        {
          role: "assistant",
          text: "🔑 Config cleared. Configure a new one below.",
        },
      ]);
      onConfigReset();
      return;
    }

    setInput("");
    setCurrentStream("");
    setHistory((prev) => [...prev, { role: "user", text: query }]);

    let aiPrompt = query;

    if (interviewQuestion) {
      const answer = query.trim();
      setInterviewQuestion(null);

      aiPrompt = buildInterviewEvaluationPrompt(interviewQuestion, answer);
    } else if (query.trim() === CMD_ENTREVISTA) {
      const question =
        INTERVIEW_QUESTIONS[
          Math.floor(Math.random() * INTERVIEW_QUESTIONS.length)
        ]!;
      setInterviewQuestion(question);
      setHistory((prev) => [
        ...prev,
        { role: "assistant", text: `👔 **ENTREVISTA TÉCNICA:**\n${question}` },
      ]);
      return;
    }

    if (!interviewQuestion && query.startsWith(CMD_DAILY_PREFIX)) {
      const updateText = query.slice(CMD_DAILY_PREFIX.length).trim();
      if (!updateText) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `You have to actually give an update, junior. Usage: ${CMD_DAILY_PREFIX.trim()} <your update in English>`,
          },
        ]);
        return;
      }
      aiPrompt = `${DAILY_PROMPT_INJECT}\n\nUser Update: "${updateText}"`;
    } else if (!interviewQuestion && query.startsWith(CMD_REVISAR_PREFIX)) {
      const filePath = query.slice(CMD_REVISAR_PREFIX.length).trim();

      if (!filePath) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `I need a file path to roast, junior. Usage: ${CMD_REVISAR_PREFIX.trim()} <src/file.ts>`,
          },
        ]);
        return;
      }

      try {
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (!exists) {
          setHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `404 Brain Not Found. The file "${filePath}" does not exist in this directory.`,
            },
          ]);
          return;
        }

        const fileContent = await file.text();
        aiPrompt = `${REVISAR_PROMPT_INJECT}\n\nFile: ${filePath}\n\n\`\`\`\n${fileContent}\n\`\`\``;
      } catch (error) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `I couldn't read the file. Probably a permissions issue, just like your database. Error: ${error}`,
          },
        ]);
        return;
      }
    }

    setIsStreaming(true);

    try {
      let userContent: string;

      if (query === CMD_ROAST) {
        const gitData = await getLatestGitDiff();
        userContent = buildRoastPrompt(gitData);
      } else {
        userContent = aiPrompt;
      }

      await streamAssistantResponse(userContent);
    } catch (error: any) {
      setHistory((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${error.message}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Box height={dimensions.rows - 1} flexDirection="row" width="100%">
      <Box
        flexGrow={1}
        flexDirection="column"
        paddingRight={1}
        borderStyle="single"
        borderRight={showSidebar}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderColor={CLI_BRAND_COLOR}
      >
        <Box marginBottom={1}>
          <Text color={CLI_BRAND_COLOR} bold>
            🦈 sudo-habla v{packageJson.version}
          </Text>
        </Box>

        <Box
          flexGrow={1}
          flexDirection="column"
          justifyContent="flex-end"
          paddingBottom={1}
          overflow="hidden"
        >
          {history.map((msg, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              {msg.role === "user" ? (
                <Text color="cyan" bold>
                  ❯ {msg.text}
                </Text>
              ) : (
                <Box borderStyle="round" borderColor="red" paddingX={1}>
                  <Markdown>{msg.text}</Markdown>
                </Box>
              )}
            </Box>
          ))}
          {currentStream && (
            <Box borderStyle="round" borderColor={CLI_BRAND_COLOR} paddingX={1}>
              <Markdown>{currentStream}</Markdown>
            </Box>
          )}
        </Box>

        {showMenu && !quiz.active && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={CLI_BRAND_COLOR}
            paddingX={1}
            marginBottom={1}
          >
            {filteredCommands.map((cmd, i) => (
              <Text
                key={cmd.value}
                color={i === 0 ? "black" : CLI_BRAND_COLOR}
                backgroundColor={i === 0 ? CLI_BRAND_COLOR : undefined}
                bold={i === 0}
              >
                {cmd.label} {i === 0 ? " [Tab to complete]" : ""}
              </Text>
            ))}
          </Box>
        )}

        {quiz.active && quiz.target && quiz.options ? (
          <Box
            flexDirection="column"
            marginY={1}
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
          >
            <Text bold color="magenta">
              🧠 Pop Quiz: What does "{quiz.target.word}" mean?
            </Text>
            <SelectInput items={quiz.options} onSelect={handleQuizSubmit} />
          </Box>
        ) : (
          <Box
            width="100%"
            backgroundColor={INPUT_BACKGROUND_COLOR}
            paddingX={1}
          >
            <TextInput
              key={inputKey}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              focus={!quiz.active}
              placeholder={
                interviewQuestion
                  ? "Type your answer in Spanish..."
                  : "Type / for commands or ask a question..."
              }
            />
          </Box>
        )}
      </Box>

      {showSidebar && (
        <Box width={35} flexDirection="column" paddingLeft={1}>
          <Text bold color={CLI_BRAND_COLOR} underline>
            Cheat Sheet
          </Text>
          <Spacer />
          {vocabList.slice(0, 10).map((v, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold color={getMasteryColor(v.mastery)}>
                {v.word}
              </Text>
              <Text dimColor>{v.translation}</Text>
            </Box>
          ))}
          {vocabList.length === 0 && (
            <Text dimColor>No vocab yet. Get roasted.</Text>
          )}
        </Box>
      )}
    </Box>
  );
};
