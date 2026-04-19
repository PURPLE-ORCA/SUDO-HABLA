import React, { useEffect, useMemo, useState } from "react";
import { Box, Spacer, Text, useStdout } from "ink";
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
import { addVocab, getVocab, type VocabEntry, updateMastery } from "../lib/vocab";
import { buildRoastPrompt, SYSTEM_PROMPT } from "../prompts/system";
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

const COMMANDS = [
  { label: '/roast - Roast your git diff', value: '/roast' },
  { label: '/lore - Get a random cynical dev story', value: '/lore' },
  { label: '/meaning <word> - Translate and explain a term', value: '/meaning ' },
  { label: '/quiz - Test your vocab mastery', value: '/quiz' },
  { label: '/config - Change provider/model', value: '/config' },
  { label: '/exit - Quit the application', value: '/exit' }
];

const getMasteryColor = (mastery = 0) => {
  if (mastery === 0) return 'red';
  if (mastery <= 2) return 'yellow';
  return 'green';
};

export const Repl = ({ config, onConfigReset }: ReplProps) => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [quiz, setQuiz] = useState<{
    active: boolean;
    target?: VocabEntry;
    options?: { label: string; value: string }[];
  }>({ active: false });

  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({ columns: stdout.columns, rows: stdout.rows });

  useEffect(() => {
    const onResize = () => setDimensions({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
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
      throw new Error(`No ${config.activeProvider} API key configured. Run /config to set one up.`);
    }

    const model =
      config.activeProvider === "gemini"
        ? createGoogleGenerativeAI({ apiKey: providerApiKey })(config.activeModel)
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

    const refreshedVocab = await getVocab();
    setVocabList(refreshedVocab);
  };

  const isTypingCommand = input.startsWith('/') && !input.includes(' ');
  const filteredCommands = COMMANDS.filter(c => c.value.startsWith(input));
  const showMenu = isTypingCommand && filteredCommands.length > 0;

  const handleCommandSelect = (item: { label: string; value: string }) => {
    setInput(item.value);
  };

  const handleQuizSubmit = async (item: { value: string }) => {
    if (!quiz.active || !quiz.target) return;

    const target = quiz.target;
    const guess = item.value;
    const isCorrect = guess === target.translation;

    setQuiz({ active: false });
    setOutput("");
    setIsStreaming(true);

    try {
      await updateMastery(target.word, isCorrect);
      const refreshedVocab = await getVocab();
      setVocabList(refreshedVocab);

      const hiddenPrompt = `The user was quizzed on the Spanish technical term "${target.word}". They guessed the translation was "${guess}". This was ${isCorrect ? "CORRECT" : "INCORRECT"}. Provide a brief, cynical response in Spanish followed by the English translation. If they were wrong, mock them. If they were right, act begrudgingly impressed.`;

      await streamAssistantResponse(hiddenPrompt);
    } catch (error: any) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (query: string) => {
    if (query.trim() === "/quiz") {
      if (vocabList.length < 4) {
        setOutput("You need at least 4 words in your Cheat Sheet to take a quiz. Run /roast or /meaning first.");
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
    if (query === "/exit") process.exit(0);

    if (query === "/config") {
      deleteConfig();
      setOutput("🔑 Config cleared. Configure a new one below.");
      onConfigReset();
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

      await streamAssistantResponse(userContent);
    } catch (error: any) {
      setOutput(`Error: ${error.message}`);
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
        borderRight={true}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderColor="#A855F7"
      >
        <Box marginBottom={1}>
          <Text color="#A855F7" bold>
            🦈 sudo-habla v{packageJson.version}
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

        {showMenu && !quiz.active && (
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
            <SelectInput
              items={filteredCommands}
              onSelect={handleCommandSelect}
            />
          </Box>
        )}

        {quiz.active && quiz.target && quiz.options ? (
          <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="magenta" paddingX={1}>
            <Text bold color="magenta">
              🧠 Pop Quiz: What does "{quiz.target.word}" mean?
            </Text>
            <SelectInput items={quiz.options} onSelect={handleQuizSubmit} />
          </Box>
        ) : (
          <Box flexDirection="row">
            <Text color="greenBright">❯ </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              focus={!showMenu}
              placeholder="Type / for commands or ask a question..."
            />
          </Box>
        )}
      </Box>

      <Box width={35} flexDirection="column" paddingLeft={1}>
        <Text bold color="#A855F7" underline>
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
        {vocabList.length === 0 && <Text dimColor>No vocab yet. Get roasted.</Text>}
      </Box>
    </Box>
  );
};
