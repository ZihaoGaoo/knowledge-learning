import { Command } from "commander";
import { once } from "node:events";
import { createInterface } from "node:readline/promises";
import { Agent, AgentSession } from "./agent.js";
import type { ChatCommandOptions, TokenUsage } from "./types.js";

const program = new Command();
const defaultTypingDelay = Number(process.env.MYCLI_TYPING_DELAY_MS ?? 8);
const interactiveIntro =
  "Entering interactive chat. Type /exit to quit, /clear to reset the conversation.\n";

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

async function runChat(
  session: AgentSession,
  message: string,
  typing: boolean
) {
  return session.chat(message, {
    onText: async (text) => {
      await renderText(text, typing);
    },
  });
}

function formatUsage(usage: TokenUsage | undefined) {
  if (!usage) {
    return null;
  }

  return `\n[token usage] prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens} rounds=${usage.rounds}\n`;
}

function isInteractiveExit(error: unknown) {
  return error instanceof Error && error.message === "Aborted with Ctrl+C";
}

async function runInteractiveChat(typing: boolean) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const agent = new Agent();
  const session = agent.createSession();

  await writeStdout(interactiveIntro);

  try {
    while (true) {
      let input: string;

      try {
        input = await readline.question("> ");
      } catch (error) {
        if (isInteractiveExit(error)) {
          await writeStdout("\n");
          return;
        }

        throw error;
      }

      const message = input.trim();

      if (!message) {
        continue;
      }

      if (message === "/exit") {
        await writeStdout("\n");
        return;
      }

      if (message === "/clear") {
        session.clear();
        await writeStdout("Conversation cleared.\n");
        continue;
      }

      const result = await runChat(session, message, typing);
      await writeStdout("\n");

      const usageText = formatUsage(result.usage);
      if (usageText) {
        await writeStdout(usageText);
      }
    }
  } finally {
    readline.close();
  }
}

program
  .name("mycli")
  .description("A minimal streaming chat CLI")
  .version("0.1.0")
  .action(async () => {
    await runInteractiveChat(true);
  });

program
  .command("chat")
  .description(
    "Send a message, or enter interactive mode when no message is provided"
  )
  .argument("[message...]", "message to send")
  .option("--no-typing", "disable the local typewriter effect")
  .action(async (messageParts: string[], options: ChatCommandOptions) => {
    if (messageParts.length === 0) {
      await runInteractiveChat(options.typing);
      return;
    }

    const agent = new Agent();
    const session = agent.createSession();
    const message = messageParts.join(" ");

    const result = await runChat(session, message, options.typing);

    process.stdout.write("\n");

    const usageText = formatUsage(result.usage);
    if (usageText) {
      process.stdout.write(usageText);
    }
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
