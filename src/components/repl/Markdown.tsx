import React from "react";
import { Text } from "ink";

const stripInlineMarkdown = (line: string) =>
  line
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trimEnd();

export const Markdown = ({ children }: { children: string }) => {
  const lines = children.split("\n");
  let inCodeBlock = false;

  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          return null;
        }

        if (inCodeBlock) {
          return (
            <Text key={`line-${i}`} color="yellow" wrap="wrap">
              {line || " "}
            </Text>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <Text key={`line-${i}`} bold color="green" wrap="wrap">
              {trimmed.slice(3)}
            </Text>
          );
        }

        if (trimmed.startsWith("# ")) {
          return (
            <Text key={`line-${i}`} bold color="magenta" wrap="wrap">
              {trimmed.slice(2)}
            </Text>
          );
        }

        if (!trimmed) {
          return <Text key={`line-${i}`}> </Text>;
        }

        return (
          <Text key={`line-${i}`} wrap="wrap">
            {stripInlineMarkdown(line)}
          </Text>
        );
      })}
    </>
  );
};
