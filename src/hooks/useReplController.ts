import { useEffect, useState } from "react";
import { useStdout } from "ink";
import { deleteConfig, type Config } from "../lib/config";
import { getLatestGitDiff, getPullRequestContext } from "../lib/git";
import { clearHistory, loadHistory, saveHistory } from "../lib/session";
import { summarizeFileBlame } from "../lib/replBlame";
import { getVocab, type VocabEntry, updateMastery } from "../lib/vocab";
import { buildQuizFromVocab } from "../lib/replQuiz";
import { streamAssistantResponse } from "../lib/replAi";
import { readFileForReview } from "../lib/replFiles";
import {
  CMD_BLAME_PREFIX,
  CMD_COMMIT,
  CMD_CLEAR,
  CMD_CONFIG,
  CMD_DAILY_PREFIX,
  CMD_ENTREVISTA,
  CMD_EXIT,
  CMD_MEANING_PREFIX,
  CMD_QUIZ,
  CMD_PR,
  CMD_REVISAR_PREFIX,
  CMD_ROAST,
  INTERVIEW_QUESTIONS,
  REPL_COMMANDS,
} from "../constants/repl";
import {
  BLAME_PROMPT_INJECT,
  buildRoastPrompt,
  COMMIT_PROMPT_INJECT,
  DAILY_PROMPT_INJECT,
  buildMentionContextPrompt,
  PR_PROMPT_INJECT,
  REVISAR_PROMPT_INJECT,
} from "../prompts/system";
import {
  buildInterviewEvaluationPrompt,
  buildQuizFeedbackPrompt,
} from "../prompts/repl";
import {
  buildBlameUsageMessage,
  buildDailyUsageMessage,
  buildFileReadErrorMessage,
  buildGenericErrorMessage,
  buildInterviewHeaderMessage,
  buildMissingBlameMessage,
  buildMissingFileMessage,
  buildPrGitErrorMessage,
  buildPrNoChangesMessage,
  buildQuizRequiresWordsMessage,
  buildRevisarUsageMessage,
  CONFIG_CLEARED_MESSAGE,
} from "../prompts/messages";
import type { Message, QuizState } from "../components/repl/types";

const THINKING_MESSAGES = [
  "Judging your architecture...",
  "Translating your spaghetti code...",
  "Finding someone to blame...",
  "Waking up the Principal Engineer...",
  "Questioning your career choices...",
];

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MESSAGE_ROTATION_MS = 1500;
const SPINNER_ROTATION_MS = 100;
const MENTION_REGEX = /@([A-Za-z0-9._/-]+(?:\.[A-Za-z0-9._-]+)?)/g;

const pickRandomThinkingMessage = () =>
  THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]!;

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
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [currentStream, setCurrentStream] = useState("");
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [quiz, setQuiz] = useState<QuizState>({ active: false });
  const [interviewQuestion, setInterviewQuestion] = useState<string | null>(null);
  const [pendingCommit, setPendingCommit] = useState<string | null>(null);
  const [pendingPr, setPendingPr] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);

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

  useEffect(() => {
    const hydrateHistory = async () => {
      const savedHistory = await loadHistory();
      setHistory(savedHistory);
      setHistoryHydrated(true);
    };

    hydrateHistory();
  }, []);

  useEffect(() => {
    if (!historyHydrated) return;

    void saveHistory(history).catch(() => {
      // Ignore disk write failures.
    });
  }, [history, historyHydrated]);

  useEffect(() => {
    if (!isThinking) return;

    setLoadingMessage(pickRandomThinkingMessage());

    const messageInterval = setInterval(() => {
      setLoadingMessage(pickRandomThinkingMessage());
    }, MESSAGE_ROTATION_MS);

    const spinnerInterval = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_ROTATION_MS);

    return () => {
      clearInterval(messageInterval);
      clearInterval(spinnerInterval);
    };
  }, [isThinking]);

  const startThinking = () => {
    setIsThinking(true);
  };

  const stopThinking = () => {
    setIsThinking(false);
    setLoadingMessage("");
    setSpinnerFrameIndex(0);
  };

  const isTypingCommand = input.startsWith("/") && !input.includes(" ");
  const filteredCommands = REPL_COMMANDS.filter((c) => c.value.startsWith(input));
  const isExactCommandMatch = REPL_COMMANDS.some((c) => c.value === input);
  const showMenu =
    isTypingCommand && filteredCommands.length > 0 && !isExactCommandMatch;
  const loadingIndicator = `${SPINNER_FRAMES[spinnerFrameIndex] ?? "⠋"} ${loadingMessage || THINKING_MESSAGES[0]}`;

  const appendAssistantError = (error: any) => {
    const message = error?.message;
    setHistory((prev) => [
      ...prev,
      { role: "assistant", text: buildGenericErrorMessage(message) },
    ]);
  };

  const stripHiddenBlock = (text: string, label: string) =>
    text.replace(new RegExp(`\\|\\|\\|${label}\\|\\|\\|[\\s\\S]*?\\|\\|\\|END_${label}\\|\\|\\|`, "g"), "").trim();

  const resolveMentionContext = async (query: string) => {
    const paths = [...query.matchAll(MENTION_REGEX)]
      .map((match) => match[1])
      .filter((path): path is string => Boolean(path));

    const uniquePaths = [...new Set(paths)];
    const contexts: { path: string; content: string }[] = [];

    for (const filePath of uniquePaths) {
      try {
        const file = Bun.file(filePath);
        if (!(await file.exists())) continue;

        const content = await file.text();
        if (!content.trim()) continue;

        contexts.push({ path: filePath, content });
      } catch {
        continue;
      }
    }

    return buildMentionContextPrompt(contexts);
  };

  const runAssistantPrompt = async (prompt: string, system?: string) => {
    let hasReceivedFirstChunk = false;

    let visibleText = await streamAssistantResponse({
      config,
      prompt,
      system,
      onText: (text) => {
        if (!hasReceivedFirstChunk && text.trim().length > 0) {
          hasReceivedFirstChunk = true;
          stopThinking();
        }
        setCurrentStream(text);
      },
    });

    const commitMatch = visibleText.match(/\|\|\|COMMIT\|\|\|([\s\S]*?)\|\|\|END_COMMIT\|\|\|/);
    if (commitMatch?.[1]) {
      setPendingCommit(commitMatch[1].trim());
      visibleText = stripHiddenBlock(visibleText, "COMMIT");
      visibleText = visibleText.replace(/\(feat:.*\)/g, "").trim();
    }

    setHistory((prev) => [...prev, { role: "assistant", text: visibleText }]);
    setCurrentStream("");
    setVocabList(await getVocab());
    return visibleText;
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
    startThinking();
    setIsStreaming(true);

    try {
      await updateMastery(target.word, isCorrect);
      setVocabList(await getVocab());

      const hiddenPrompt = buildQuizFeedbackPrompt(target.word, guess, isCorrect);
      await runAssistantPrompt(hiddenPrompt);
    } catch (error) {
      stopThinking();
      appendAssistantError(error);
    } finally {
      stopThinking();
      setIsStreaming(false);
    }
  };

  const handleCommitConfirm = async (item: { value: string }) => {
    if (!pendingCommit) return;

    startThinking();
    const choice = item.value;

    if (choice === "yes") {
      try {
        const proc = Bun.spawnSync({
          cmd: ["git", "commit", "-m", pendingCommit],
          stderr: "pipe",
        });
        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Unknown git error");
        }
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "✅ Commit executed. Don't break production.",
          },
        ]);
      } catch (e: any) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `❌ Failed to execute git commit: ${e?.message ?? e}`,
          },
        ]);
      }
    } else {
      setHistory((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Commit aborted. Coward." },
      ]);
    }

    setPendingCommit(null);
    stopThinking();
  };

  const handlePrAction = async (item: { value: string }) => {
    if (!pendingPr) return;

    const prBody = pendingPr.trim();
    setPendingPr(null);

    if (item.value === "copy") {
      try {
        const proc = Bun.spawnSync({
          cmd: ["/bin/sh", "-c", "printf '%s' \"$SUDO_HABLA_PR_BODY\" | pbcopy"],
          env: { ...process.env, SUDO_HABLA_PR_BODY: prBody },
          stderr: "pipe",
        });
        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "pbcopy failed");
        }
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: "PR body copied to clipboard." },
        ]);
      } catch (error: any) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: `Clipboard copy failed: ${error?.message ?? error}` },
        ]);
      }
      return;
    }

    if (item.value === "file") {
      try {
        await Bun.write("PR_DESCRIPTION.md", `${prBody}\n`);
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: "Wrote PR_DESCRIPTION.md in project root." },
        ]);
      } catch (error: any) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: `Failed to write PR_DESCRIPTION.md: ${error?.message ?? error}` },
        ]);
      }
      return;
    }

    setHistory((prev) => [
      ...prev,
      { role: "assistant", text: "PR output skipped. Manual selection remains your punishment." },
    ]);
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

    if (trimmedQuery === CMD_CLEAR) {
      await clearHistory();
      setInput("");
      setCurrentStream("");
      setHistory([]);
      setQuiz({ active: false });
      setInterviewQuestion(null);
      setPendingCommit(null);
      setPendingPr(null);
      return;
    }

    setInput("");
    setCurrentStream("");
    setHistory((prev) => [...prev, { role: "user", text: query }]);

    let aiPrompt = query;
    const isPrCommand = query.trim() === CMD_PR;

    if (query.trim() === CMD_COMMIT) {
      startThinking();
      try {
        let proc = Bun.spawnSync(["git", "diff", "--staged"]);
        let diff = proc.stdout.toString().trim();

        if (!diff) {
          proc = Bun.spawnSync(["git", "diff"]);
          diff = proc.stdout.toString().trim();
        }

        if (!diff) {
          stopThinking();
          setHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "There are no changes to commit, junior. Write some code first.",
            },
          ]);
          return;
        }

        const truncatedDiff =
          diff.length > 5000
            ? diff.substring(0, 5000) + "\n...[DIFF TRUNCATED]"
            : diff;

        aiPrompt = `${COMMIT_PROMPT_INJECT}\n\nGit Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
      } catch (error) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Git failed. Are you even in a repository? Error: ${error}`,
          },
        ]);
        return;
      }
    }

    if (isPrCommand) {
      startThinking();
      try {
        const prContext = await getPullRequestContext();

        if (!prContext) {
          stopThinking();
          setHistory((prev) => [
            ...prev,
            { role: "assistant", text: buildPrNoChangesMessage() },
          ]);
          return;
        }

        aiPrompt = `${PR_PROMPT_INJECT}\n\n${prContext}`;
      } catch (error) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: buildPrGitErrorMessage(error) },
        ]);
        return;
      }
    }

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
    } else if (!interviewQuestion && query.startsWith(CMD_BLAME_PREFIX)) {
      startThinking();
      const filePath = query.slice(CMD_BLAME_PREFIX.length).trim();

      if (!filePath) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: buildBlameUsageMessage(CMD_BLAME_PREFIX.trim()),
          },
        ]);
        return;
      }

      try {
        const blameSummary = await summarizeFileBlame(filePath);

        if (!blameSummary) {
          const file = Bun.file(filePath);
          const exists = await file.exists();
          stopThinking();
          setHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              text: exists
                ? buildMissingBlameMessage(filePath)
                : buildMissingFileMessage(filePath),
            },
          ]);
          return;
        }

        const snippetLines = blameSummary.snippets
          .map((snippet) => `- line ${snippet.lineNumber}: ${snippet.content}`)
          .join("\n");

        aiPrompt = `${BLAME_PROMPT_INJECT}\n\nFile: ${blameSummary.filePath}\nCulprit: ${blameSummary.culprit}\nOwned non-empty lines: ${blameSummary.lineCount}\nBlamed snippets:\n${snippetLines}`;
      } catch (error) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: buildFileReadErrorMessage(error) },
        ]);
        return;
      }
    } else if (!interviewQuestion && query.startsWith(CMD_REVISAR_PREFIX)) {
      startThinking();
      const filePath = query.slice(CMD_REVISAR_PREFIX.length).trim();

      if (!filePath) {
        stopThinking();
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
          stopThinking();
          setHistory((prev) => [
            ...prev,
            { role: "assistant", text: buildMissingFileMessage(filePath) },
          ]);
          return;
        }

        aiPrompt = `${REVISAR_PROMPT_INJECT}\n\nFile: ${filePath}\n\n\`\`\`\n${fileResult.content}\n\`\`\``;
      } catch (error) {
        stopThinking();
        setHistory((prev) => [
          ...prev,
          { role: "assistant", text: buildFileReadErrorMessage(error) },
        ]);
        return;
      }
    }

    startThinking();
    setIsStreaming(true);

    try {
      const mentionContext = await resolveMentionContext(query);
      const userContent =
        query === CMD_ROAST
          ? buildRoastPrompt(await getLatestGitDiff())
          : aiPrompt;
      const visibleText = await runAssistantPrompt(userContent, mentionContext || undefined);
      if (isPrCommand && visibleText.trim()) {
        setPendingPr(visibleText);
      }
    } catch (error) {
      stopThinking();
      appendAssistantError(error);
    } finally {
      stopThinking();
      setIsStreaming(false);
    }
  };

  return {
    dimensions,
    input,
    inputKey,
    isStreaming,
    isThinking,
    history,
    historyHydrated,
    currentStream,
    loadingMessage,
    loadingIndicator,
    vocabList,
    showSidebar,
    quiz,
    interviewQuestion,
    pendingCommit,
    pendingPr,
    filteredCommands,
    showMenu,
    setInput,
    handleGlobalInput,
    handleQuizSubmit,
    handleCommitConfirm,
    handlePrAction,
    handleSubmit,
  };
};
