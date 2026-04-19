import React, { useMemo } from "react";
import { Text } from "ink";
import { marked } from "marked";
// @ts-ignore - marked-terminal lacks TypeScript definitions
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";

let markedConfigured = false;

if (!markedConfigured) {
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

  markedConfigured = true;
}

export const Markdown = ({ children }: { children: string }) => {
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
