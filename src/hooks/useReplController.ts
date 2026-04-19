import { useEffect, useState } from "react";
import { useStdout } from "ink";
import { deleteConfig, type Config } from "../lib/config";
import { getLatestGitDiff } from "../lib/git";
import { getVocab, type VocabEntry, updateMastery } from "../lib/vocab";
import { buildQuizFromVocab } from "../lib/replQuiz";
import { streamAssistantResponse } from "../lib/replAi";
import { readFileForReview } from "../lib/replFiles";
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
import {
  buildRoastPrompt,
  DAILY_PROMPT_INJECT,
  REVISAR_PROMPT_INJECT,
} from "../prompts/system";
import {
  buildInterviewEvaluationPrompt,
  buildQuizFeedbackPrompt,
} from "../prompts/repl";
import {
  buildDailyUsageMessage,
  buildFileReadErrorMessage,
  buildGenericErrorMessage,
  buildInterviewHeaderMessage,
  buildMissingFileMessage,
  buildQuizRequiresWordsMessage,
  buildRevisarUsageMessage,
  CONFIG_CLEARED_MESSAGE,
} from "../prompts/messages";
import type { Message, QuizState } from "../components/repl/types";

export const useReplController = ({
  config,
  onConfigReset,
}: {
  config: Config;
  onConfigReset: () => void;
}) => {
  const [input, setInput] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentStream, setCurrentStream] = useState("");
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [quiz, setQuiz] = useState<QuizState>({ active: false });
  const [interviewQuestion, setInterviewQuestion] = useState<string | null>(null);

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

  const isTypingCommand = input.startsWith("/") && !input.includes(" ");
  const filteredCommands = REPL_COMMANDS.filter((c) => c.value.startsWith(input));
  const isExactCommandMatch = REPL_COMMANDS.some((c) => c.value === input);
  const showMenu =
    isTypingCommand && filteredCommands.length > 0 && !isExactCommandMatch;

  const appendAssistantError = (error: any) => {
    const message = error?.message;
    setHistory((prev) => [
      ...prev,
      { role: "assistant", text: buildGenericErrorMessage(message) },
    ]);
  };

  const runAssistantPrompt = async (prompt: string) => {
    const visibleText = await streamAssistantResponse({
      config,
      prompt,
      onText: setCurrentStream,
    });
    setHistory((prev) => [...prev, { role: "assistant", text: visibleText }]);
    setCurrentStream("");
    setVocabList(await getVocab());
  };

  const handleGlobalInput = (char: string, key: { ctrl?: boolean; tab?: boolean }) => {
    if (key.ctrl && char === "b") {
      setShowSidebar((prev) => !prev);
    }

    if (key.tab && showMenu && filteredCommands.length > 0) {
      const match = filteredCommands[0]!.value;
      setInput(match.endsWith(" ") ? match : `${match} `);
      setInputKey((prev) => prev + 1);
    }
  };

  const handleQuizSubmit = async (item: { value: string }) => {
    if (!quiz.active || !quiz.target) return;

    const target = quiz.target;
    const guess = item.value;
    const isCorrect = guess === target.translation;

    setQuiz({ active: false });
    setIsStreaming(true);

    try {
      await updateMastery(target.word, isCorrect);
      setVocabList(await getVocab());

      const hiddenPrompt = buildQuizFeedbackPrompt(target.word, guess, isCorrect);
      await runAssistantPrompt(hiddenPrompt);
    } catch (error) {
      appendAssistantError(error);
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
            text: buildQuizRequiresWordsMessage(
              CMD_ROAST,
              CMD_MEANING_PREFIX.trim(),
            ),
          },
        ]);
        return;
      }

      setQuiz({ active: true, ...buildQuizFromVocab(vocabList) });
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
        { role: "assistant", text: CONFIG_CLEARED_MESSAGE },
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
        INTERVIEW_QUESTIONS[Math.floor(Math.random() * INTERVIEW_QUESTIONS.length)]!;
      setInterviewQuestion(question);
      setHistory((prev) => [
        ...prev,
        { role: "assistant", text: buildInterviewHeaderMessage(question) },
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
            text: buildDailyUsageMessage(CMD_DAILY_PREFIX.trim()),
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
            text: buildRevisarUsageMessage(CMD_REVISAR_PREFIX.trim()),
          },
        ]);
        return;
      }

      try {
        const fileResult = await readFileForReview(filePath);

        if (!fileResult.exists) {
          setHistory((prev) => [
            ...prev,
            { role: "assistant", text: buildMissingFileMessage(filePath) },
          ]);
          return;
        }

        aiPrompt = `${REVISAR_PROMPT_INJECT}\n\nFile: ${filePath}\n\n\`\`\`\n${fileResult.content}\n\`\`\``;
      } catch (error) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: buildFileReadErrorMessage(error) },
        ]);
        return;
      }
    }

    setIsStreaming(true);

    try {
      const userContent =
        query === CMD_ROAST
          ? buildRoastPrompt(await getLatestGitDiff())
          : aiPrompt;
      await runAssistantPrompt(userContent);
    } catch (error) {
      appendAssistantError(error);
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    dimensions,
    input,
    inputKey,
    isStreaming,
    history,
    currentStream,
    vocabList,
    showSidebar,
    quiz,
    interviewQuestion,
    filteredCommands,
    showMenu,
    setInput,
    handleGlobalInput,
    handleQuizSubmit,
    handleSubmit,
  };
};
