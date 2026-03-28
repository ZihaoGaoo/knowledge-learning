import { randomUUID } from "node:crypto";
import OpenAI from "openai";

type MiniMaxChatCompletionCreateParamsStreaming =
  OpenAI.ChatCompletionCreateParamsStreaming & {
    reasoning_split?: boolean;
  };

type UserChatRequest = {
  content: string;
  conversationId?: string;
  role?: "user";
};

type ToolChatRequest = {
  content: string;
  conversationId?: string;
  role: "tool";
  toolCallId: string;
};

type ChatRequest = UserChatRequest | ToolChatRequest;

type ChatOptions = {
  onText?: (text: string) => void | Promise<void>;
};

export class Agent {
  #client: OpenAI;
  #messageMap = new Map<string, OpenAI.ChatCompletionMessageParam[]>();

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    this.#client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }

  async chat(chatRequest: ChatRequest, options: ChatOptions = {}) {
    const conversationId = chatRequest.conversationId ?? randomUUID();
    const messages = this.#messageMap.get(conversationId) ?? [];

    if (chatRequest.role === "tool") {
      messages.push({
        role: "tool",
        content: chatRequest.content,
        tool_call_id: chatRequest.toolCallId,
      });
    } else {
      messages.push({
        role: "user",
        content: chatRequest.content,
      });
    }

    this.#messageMap.set(conversationId, messages);

    const request: MiniMaxChatCompletionCreateParamsStreaming = {
      model: process.env.OPENAI_MODEL ?? "MiniMax-M2.7",
      messages,
      stream: true,
      reasoning_split: true,
    };

    const stream = await this.#client.chat.completions.create(request);

    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta?.content) {
        continue;
      }

      assistantContent += delta.content;
      if (options.onText) {
        await options.onText(delta.content);
      } else {
        process.stdout.write(delta.content);
      }
    }

    messages.push({
      role: "assistant",
      content: assistantContent,
    });
    this.#messageMap.set(conversationId, messages);

    return {
      conversationId,
      content: assistantContent,
    };
  }
}
