import { intro, outro, text, spinner, isCancel } from "@clack/prompts";
import OpenAI from "openai";
import { config } from "dotenv";

config();

// Agnostic LLM Client
const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY,
});

// The secret sauce that stops the LLM from acting like a boring textbook
const SYSTEM_PROMPT = `
You are a cynical, senior software engineer teaching a junior developer Spanish. 
Do not teach complex grammar rules or conjugate verbs. Teach simple, repeatable, practical phrases. 
All vocabulary and examples must revolve around software engineering, debugging, coffee, or office politics. 
If the user types "/lore", give them a quick, cynical phrase of the day.
If the user types "/meaning [word]", translate it and give a coding-related example.
Keep responses concise, formatted cleanly for a terminal, and don't be overly polite.
`;

async function main() {
  console.clear();
  intro("🌮 Bienvenido a sudo-habla. Speak up or git checkout.");

  while (true) {
    const userInput = await text({
      message:
        "Command or phrase? (/lore, /meaning <word>, or just type to chat)",
      placeholder: "/lore",
    });

    if (isCancel(userInput) || userInput === "/exit" || userInput === "exit") {
      outro("Adios. Try not to break production on your way out.");
      process.exit(0);
    }

    const s = spinner();
    s.start("Asking the senior dev...");

    try {
      const stream = await openai.chat.completions.create({
        model: process.env.MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput.toString() }
        ],
        stream: true, // This is the magic word
      });
      
      // Stop the spinner the millisecond the API connects
      s.stop('Senior dev is speaking:');
      
      // Stream the chunks directly to the terminal
      for await (const chunk of stream) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');
      }
      console.log('\n'); // Clean newline when it finishes
      
    } catch (error: any) {
      s.stop(`Error: ${error.message}. Is your API key actually valid?`);
    }
  }
}

main().catch(console.error);
