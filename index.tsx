import React, { useState, useMemo } from "react";
import { render, Box, Text, Spacer } from "ink";
import TextInput from "ink-text-input";
import { marked } from "marked";
// @ts-ignore - marked-terminal lacks TypeScript definitions
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import OpenAI from "openai";
import { config } from "dotenv";
import { $ } from "bun";

config();

// Configure marked to use terminal renderer via extension
marked.use(
  markedTerminal({
    // Styling options
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
    // Formatting options
    width: 80,
    reflowText: false,
    emoji: true,
    tab: 2,
  })
);

// Markdown component that renders markdown as formatted terminal text
const Markdown = ({ children }: { children: string }) => {
  const rendered = useMemo(() => {
    if (!children) return "";
    try {
      // marked.parse returns ANSI-colored string via marked-terminal
      return marked.parse(children, { async: false }) as string;
    } catch {
      return children; // Fallback to raw text on error
    }
  }, [children]);

  // Split by newlines and render each line to preserve ANSI codes
  const lines = rendered.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Text key={`line-${i}-${line.length}`}>{line || " "}</Text>
      ))}
    </>
  );
};

// Get git diff or fallback to last commit stats, truncated to 2000 chars
const getGitRoastData = async (): Promise<string> => {
  try {
    // Try git diff first
    const diffResult = await $`git diff`.quiet().text();
    
    if (diffResult.trim()) {
      return diffResult.slice(0, 2000);
    }
    
    // Fallback to last commit stats if no uncommitted changes
    const showResult = await $`git show HEAD --stat`.quiet().text();
    return showResult.slice(0, 2000);
  } catch {
    // Not a git repo or other git error
    throw new Error("No estás en un repositorio git. ¿Qué intentas esconder?");
  }
};

const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY,
});

const SYSTEM_PROMPT = `
You are a cynical, senior software engineer teaching a junior developer Spanish. 
Teach simple, repeatable, practical phrases. 
All vocabulary and examples must revolve around software engineering, debugging, coffee, or office politics. 
If the user types "/lore", give them a quick phrase of the day.
You must keep responses brutally short. MAXIMUM 3 to 4 sentences. NEVER use markdown tables or long lists. For every Spanish phrase or insult you generate, you MUST provide the direct English translation immediately after it so a beginner can understand.
Format beautifully using markdown.
`;

const SudoHabla = () => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState("");

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;
    if (query === "/exit") process.exit(0);

    setInput("");
    setOutput("");
    setIsStreaming(true);

    try {
      let userContent: string;

      if (query === "/roast") {
        // Get git data and build roast query
        const gitData = await getGitRoastData();
        userContent = `Here is my git diff. Roast this code and my technical skills in MAXIMUM 3 short sentences. Give the roast in Spanish, followed immediately by the English translation. Be cynical, do not use tables, and do not yap.

Then append a new section titled '💡 El Arreglo (The Fix)'. In one concise, bilingual sentence, cynically correct their technical mistake with the specific pattern or fix they should use. Spanish first, then English translation immediately after.

${gitData}`;
      } else {
        userContent = query;
      }

      const stream = await openai.chat.completions.create({
        model: process.env.MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        // Append incoming tokens to React state
        setOutput((prev) => prev + content);
      }
    } catch (error: any) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* Header - always at top */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🦈 sudo-habla v0.1
        </Text>
      </Box>

      {/* Output area - grows to fill available space */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {output && (
          <Box
            marginBottom={1}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            flexDirection="column"
          >
            <Markdown>{output}</Markdown>
          </Box>
        )}
        <Spacer />
      </Box>

      {/* Input area - always anchored at bottom */}
      <Box marginTop={1}>
        <Box marginRight={1}>
          <Text color="green">❯</Text>
        </Box>
        {isStreaming ? (
          <Text color="yellow">El senior está escribiendo...</Text>
        ) : (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="/lore, /roast, /meaning <word>, /exit"
          />
        )}
      </Box>
    </Box>
  );
};

render(<SudoHabla />);
