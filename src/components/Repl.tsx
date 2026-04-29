import React from "react";
import { Box, useInput } from "ink";
import { CLI_BRAND_COLOR } from "../constants/ui";
import { useReplController } from "../hooks/useReplController";
import type { Config } from "../lib/config";
import packageJson from "../../package.json";
import { CommandMenu } from "./repl/CommandMenu";
import { MentionMenu } from "./repl/MentionMenu";
import { HistoryPane } from "./repl/HistoryPane";
import { InputBar } from "./repl/InputBar";
import { CommitConfirmPanel } from "./repl/CommitConfirmPanel";
import { PrActionPanel } from "./repl/PrActionPanel";
import { QuizPanel } from "./repl/QuizPanel";
import { ReplHeader } from "./repl/ReplHeader";
import { VocabSidebar } from "./repl/VocabSidebar";

interface ReplProps {
  config: Config;
  onConfigReset: () => void;
}

export const Repl = ({ config, onConfigReset }: ReplProps) => {
  const repl = useReplController({ config, onConfigReset });

  useInput(repl.handleGlobalInput, { isActive: true });

  return (
    <Box
      height={repl.dimensions.rows - 1}
      flexDirection="row"
      width="100%"
      overflow="hidden"
    >
      <Box
        flexGrow={1}
        flexShrink={1}
        flexDirection="column"
        paddingRight={1}
        borderStyle="single"
        borderRight={repl.showSidebar}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderColor={CLI_BRAND_COLOR}
        overflow="hidden"
      >
        <ReplHeader version={packageJson.version} updateAvailable={repl.updateAvailable} />
        <HistoryPane
          key={repl.historyHydrated ? "history-ready" : "history-boot"}
          history={repl.history}
          currentStream={repl.currentStream}
          isThinking={repl.isThinking}
          loadingIndicator={repl.loadingIndicator}
          scrollOffset={repl.scrollOffset}
          maxVisible={repl.maxVisible}
        />
        <CommandMenu
          showMenu={repl.showMenu && !repl.quiz.active && !repl.pendingPr}
          filteredCommands={repl.filteredCommands}
        />
        <MentionMenu
          showMenu={repl.showMentionMenu && !repl.quiz.active && !repl.pendingPr}
          suggestions={repl.mentionSuggestions}
        />
        <QuizPanel quiz={repl.quiz} onSelect={repl.handleQuizSubmit} />
        {repl.pendingCommit && (
          <CommitConfirmPanel
            message={repl.pendingCommit}
            onSelect={repl.handleCommitConfirm}
          />
        )}
        {repl.pendingPr && <PrActionPanel onSelect={repl.handlePrAction} />}
        {!repl.quiz.active && !repl.pendingCommit && !repl.pendingPr && (
          <InputBar
            input={repl.input}
            inputKey={repl.inputKey}
            interviewQuestion={repl.interviewQuestion}
            quizActive={repl.quiz.active}
            onChange={repl.setInput}
            onSubmit={repl.handleSubmit}
          />
        )}
      </Box>

      <VocabSidebar showSidebar={repl.showSidebar} vocabList={repl.vocabList} />
    </Box>
  );
};
