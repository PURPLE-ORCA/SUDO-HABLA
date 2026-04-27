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
    flexShrink={1}
    flexDirection="column"
    justifyContent="flex-end"
    paddingBottom={1}
    overflow="hidden"
    width="100%"
  >
    {history.map((msg, i) => (
      <Box key={i} flexDirection="column" marginBottom={1} flexShrink={0}>
        {msg.role === "user" ? (
          <Text color="cyan" bold wrap="truncate-end">
            ❯ {msg.text}
          </Text>
        ) : (
          <Box
            borderStyle="round"
            borderColor="red"
            paddingX={1}
            flexDirection="column"
            width="100%"
            overflow="hidden"
          >
            <Markdown>{msg.text}</Markdown>
          </Box>
        )}
      </Box>
    ))}
    {currentStream && (
      <Box
        borderStyle="round"
        borderColor={CLI_BRAND_COLOR}
        paddingX={1}
        flexDirection="column"
        width="100%"
        overflow="hidden"
      >
        <Markdown>{currentStream}</Markdown>
      </Box>
    )}
  </Box>
);
