import { Command } from "commander";
import { once } from "node:events";
import { Agent } from "./agent.js";

const program = new Command();
const defaultTypingDelay = Number(process.env.MYCLI_TYPING_DELAY_MS ?? 8);

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function writeStdout(text: string) {
  if (process.stdout.write(text)) {
    return;
  }

  await once(process.stdout, "drain");
}

async function renderText(text: string, typing: boolean) {
  if (!typing) {
    await writeStdout(text);
    return;
  }

  for (const char of text) {
    await writeStdout(char);
    if (defaultTypingDelay > 0) {
      await sleep(defaultTypingDelay);
    }
  }
}

program
  .name("mycli")
  .description("A minimal streaming chat CLI")
  .version("0.1.0");

program
  .command("chat")
  .argument("<message...>", "message to send")
  .option("--no-typing", "disable the local typewriter effect")
  .action(async (messageParts: string[], options: { typing: boolean }) => {
    const agent = new Agent();
    const message = messageParts.join(" ");

    await agent.chat(
      {
        content: message,
      },
      {
        onText: async (text) => {
          await renderText(text, options.typing);
        },
      }
    );

    process.stdout.write("\n");
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
