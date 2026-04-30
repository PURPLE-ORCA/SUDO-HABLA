import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";
import { Header } from "../Header";
import { Markdown } from "./Markdown";
import type { Message } from "./types";

interface HistoryPaneProps {
  history: Message[];
  currentStream: string;
  isThinking: boolean;
  loadingIndicator: string;
  scrollOffset: number;
  maxVisible: number;
}

export const HistoryPane = ({
  history,
  currentStream,
  isThinking,
  loadingIndicator,
  scrollOffset,
  maxVisible,
}: HistoryPaneProps) => {
  const start = Math.max(0, history.length - maxVisible - scrollOffset);
  const end = history.length - scrollOffset;
  const visible = history.slice(start, end);
    const hasOlder = scrollOffset > 0;
    const hasNewer = scrollOffset > 0 && end < history.length;

  return (
  <Box
    flexGrow={1}
    flexShrink={1}
    flexDirection="column"
    justifyContent="flex-end"
    paddingBottom={1}
    overflow="hidden"
    width="100%"
  >
    <Header />
    {hasOlder && (
      <Box flexShrink={0} justifyContent="center" marginBottom={1}>
        <Text dimColor>↑ {scrollOffset} older messages ↑</Text>
      </Box>
    )}
    {visible.map((msg, i) => (
      <Box key={i} flexDirection="column" marginBottom={1} flexShrink={0}>
        {msg.role === "user" ? (
          <Text color="cyan" bold wrap="truncate-end">
            ❯ {msg.text}
          </Text>
        ) : (
          <Box
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
    {hasNewer && (
      <Box flexShrink={0} justifyContent="center" marginTop={1}>
        <Text dimColor>↓ newer messages below ↓</Text>
      </Box>
    )}
    {isThinking && (
      <Box marginBottom={1} flexShrink={0}>
        <Text color="magenta">{loadingIndicator}</Text>
      </Box>
    )}
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
    <Box flexShrink={0} justifyContent="center" marginTop={1}>
      <Text dimColor>
        [{history.length - end}..{end}/{history.length} msgs | offset:{scrollOffset} | visible:{visible.length}/{maxVisible}]
      </Text>
    </Box>
  </Box>
);
};
