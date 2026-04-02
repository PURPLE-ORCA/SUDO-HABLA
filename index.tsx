import React, { useState } from "react";
import { render, Box, Text, Spacer } from "ink";
import TextInput from "ink-text-input";
import Markdown from "ink-markdown";
import OpenAI from "openai";
import { config } from "dotenv";

config();

const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY,
});

const SYSTEM_PROMPT = `
You are a cynical, senior software engineer teaching a junior developer Spanish. 
Teach simple, repeatable, practical phrases. 
All vocabulary and examples must revolve around software engineering, debugging, coffee, or office politics. 
If the user types "/lore", give them a quick phrase of the day.
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
      const stream = await openai.chat.completions.create({
        model: process.env.MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
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
            placeholder="Type /lore, /meaning <word>, or /exit"
          />
        )}
      </Box>
    </Box>
  );
};

render(<SudoHabla />);
