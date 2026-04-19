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
import { addVocab, getVocab, type VocabEntry, updateMastery } from "../lib/vocab";
import { buildRoastPrompt, DAILY_PROMPT_INJECT, SYSTEM_PROMPT } from "../prompts/system";
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

type Message = { role: 'user' | 'assistant'; text: string };

const COMMANDS = [
  { label: '/roast - Roast your git diff', value: '/roast' },
  { label: '/lore - Get a random cynical dev story', value: '/lore' },
  { label: '/daily <update> - Give your standup update', value: '/daily ' },
  { label: '/entrevista - Start a technical interview', value: '/entrevista' },
  { label: '/meaning <word> - Translate and explain a term', value: '/meaning ' },
  { label: '/quiz - Test your vocab mastery', value: '/quiz' },
  { label: '/config - Change provider/model', value: '/config' },
  { label: '/exit - Quit the application', value: '/exit' }
];

const INTERVIEW_QUESTIONS = [
  "¿Cuál es la diferencia entre una promesa y un callback?",
  "Explícame qué es el DOM virtual en React.",
  "¿Por qué usarías Docker en un proyecto nuevo?",
  "¿Qué es la inyección de SQL y cómo la previenes?",
  "¿Cómo funciona el Event Loop en Node.js o JavaScript?"
];

const getMasteryColor = (mastery = 0) => {
  if (mastery === 0) return 'red';
  if (mastery <= 2) return 'yellow';
  return 'green';
};

export const Repl = ({ config, onConfigReset }: ReplProps) => {
  const [input, setInput] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentStream, setCurrentStream] = useState("");
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [quiz, setQuiz] = useState<{
    active: boolean;
    target?: VocabEntry;
    options?: { label: string; value: string }[];
  }>({ active: false });
  const [interviewQuestion, setInterviewQuestion] = useState<string | null>(null);

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
      setCurrentStream(visibleText);
    }

    const visibleText = fullText.split("|||VOCAB|||")[0] ?? "";

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

    setHistory(prev => [...prev, { role: 'assistant', text: visibleText }]);
    setCurrentStream("");
    const refreshedVocab = await getVocab();
    setVocabList(refreshedVocab);
  };

  const isTypingCommand = input.startsWith('/') && !input.includes(' ');
  const filteredCommands = COMMANDS.filter(c => c.value.startsWith(input));
  const isExactCommandMatch = COMMANDS.some(c => c.value === input);
  const showMenu = isTypingCommand && filteredCommands.length > 0 && !isExactCommandMatch;

  useInput((char, key) => {
    if (key.tab && showMenu && filteredCommands.length > 0) {
      const match = filteredCommands[0]!.value;
      setInput(match.endsWith(' ') ? match : match + ' ');
      setInputKey((prev) => prev + 1);
    }
  }, { isActive: showMenu });

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

      const hiddenPrompt = `The user was quizzed on the Spanish technical term "${target.word}". They guessed the translation was "${guess}". This was ${isCorrect ? "CORRECT" : "INCORRECT"}. Provide a brief, cynical response in Spanish followed by the English translation. If they were wrong, mock them. If they were right, act begrudgingly impressed.`;

      await streamAssistantResponse(hiddenPrompt);
    } catch (error: any) {
      setHistory(prev => [...prev, { role: 'assistant', text: `Error: ${error.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (query: string) => {
    if (query.trim() === "/quiz") {
      if (vocabList.length < 4) {
        setHistory(prev => [...prev, { role: 'user', text: '/quiz' }, { role: 'assistant', text: "You need at least 4 words in your Cheat Sheet to take a quiz. Run /roast or /meaning first." }]);
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
      setHistory(prev => [...prev, { role: 'user', text: '/config' }, { role: 'assistant', text: "🔑 Config cleared. Configure a new one below." }]);
      onConfigReset();
      return;
    }

    setInput("");
    setCurrentStream("");
    setHistory(prev => [...prev, { role: 'user', text: query }]);

    let aiPrompt = query;

    if (interviewQuestion) {
      const answer = query.trim();
      setInterviewQuestion(null);

      aiPrompt = `Act as a ruthless Principal Engineer conducting a technical interview in Spanish.
  You asked the candidate: "${interviewQuestion}"
  The candidate answered: "${answer}"
  Grade their technical accuracy and their Spanish grammar. Be brutally honest. If they used English, roast them for it. Provide the correct answer in perfect technical Spanish. Remember to append the |||VOCAB||| JSON block at the end.`;
    } else if (query.trim() === '/entrevista') {
      const question = INTERVIEW_QUESTIONS[Math.floor(Math.random() * INTERVIEW_QUESTIONS.length)]!;
      setInterviewQuestion(question);
      setHistory(prev => [...prev, { role: 'assistant', text: `👔 **ENTREVISTA TÉCNICA:**\n${question}` }]);
      return;
    }

    if (!interviewQuestion && query.startsWith('/daily ')) {
      const updateText = query.slice(7).trim();
      if (!updateText) {
        setHistory(prev => [...prev, { role: 'assistant', text: "You have to actually give an update, junior. Usage: /daily <your update in English>" }]);
        return;
      }
      aiPrompt = `${DAILY_PROMPT_INJECT}\n\nUser Update: "${updateText}"`;
    }

    setIsStreaming(true);

    try {
      let userContent: string;

      if (query === "/roast") {
        const gitData = await getLatestGitDiff();
        userContent = buildRoastPrompt(gitData);
      } else {
        userContent = aiPrompt;
      }

      await streamAssistantResponse(userContent);
    } catch (error: any) {
      setHistory(prev => [...prev, { role: 'assistant', text: `Error: ${error.message}` }]);
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
            <Box borderStyle="round" borderColor="#A855F7" paddingX={1}>
              <Markdown>{currentStream}</Markdown>
            </Box>
          )}
        </Box>

        {showMenu && !quiz.active && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="#A855F7"
            paddingX={1}
            marginBottom={1}
          >
            {filteredCommands.map((cmd, i) => (
              <Text
                key={cmd.value}
                color={i === 0 ? 'black' : '#A855F7'}
                backgroundColor={i === 0 ? '#A855F7' : undefined}
                bold={i === 0}
              >
                {cmd.label} {i === 0 ? ' [Tab to complete]' : ''}
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
          <Box width="100%" backgroundColor="#3300667f" paddingX={1}>
            <TextInput
              key={inputKey}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              focus={!quiz.active}
              placeholder={interviewQuestion ? "Type your answer in Spanish..." : "Type / for commands or ask a question..."}
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
        {vocabList.length === 0 && (
          <Text dimColor>No vocab yet. Get roasted.</Text>
        )}
      </Box>
    </Box>
  );
};
