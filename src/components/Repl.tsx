import React from "react";
import { Box, useInput } from "ink";
import { CLI_BRAND_COLOR } from "../constants/ui";
import { useReplController } from "../hooks/useReplController";
import type { Config } from "../lib/config";
import packageJson from "../../package.json";
import { CommandMenu } from "./repl/CommandMenu";
import { HistoryPane } from "./repl/HistoryPane";
import { InputBar } from "./repl/InputBar";
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
    <Box height={repl.dimensions.rows - 1} flexDirection="row" width="100%">
      <Box
        flexGrow={1}
        flexDirection="column"
        paddingRight={1}
        borderStyle="single"
        borderRight={repl.showSidebar}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderColor={CLI_BRAND_COLOR}
      >
        <ReplHeader version={packageJson.version} />
        <HistoryPane history={repl.history} currentStream={repl.currentStream} />
        <CommandMenu
          showMenu={repl.showMenu && !repl.quiz.active}
          filteredCommands={repl.filteredCommands}
        />
        <QuizPanel quiz={repl.quiz} onSelect={repl.handleQuizSubmit} />
        {!repl.quiz.active && (
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
