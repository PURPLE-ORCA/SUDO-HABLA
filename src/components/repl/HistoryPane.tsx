import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";
import { Markdown } from "./Markdown";
import type { Message } from "./types";

interface HistoryPaneProps {
  history: Message[];
  currentStream: string;
}

export const HistoryPane = ({ history, currentStream }: HistoryPaneProps) => (
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
);
