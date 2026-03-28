import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type {
  AgentConfig,
  AgentMessage,
  ChatOptions,
  ChatRequest,
  ChatResult,
  ConversationState,
  SessionChatOptions,
  SessionOptions,
  SessionToolResultOptions,
  StreamingChatRequest,
} from "./types.js";

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value !== "false" && value !== "0";
}

function toConversationMessage(chatRequest: ChatRequest): AgentMessage {
  if (chatRequest.role === "tool") {
    return {
      role: "tool",
      content: chatRequest.content,
      tool_call_id: chatRequest.toolCallId,
    };
  }

  return {
    role: "user",
    content: chatRequest.content,
  };
}

function cloneMessages(messages: AgentMessage[]) {
  return structuredClone(messages);
}

function buildRequestMessages(state: ConversationState): AgentMessage[] {
  if (!state.systemPrompt) {
    return state.messages;
  }

  return [
    {
      role: "system",
      content: state.systemPrompt,
    },
    ...state.messages,
  ];
}

export function loadAgentConfigFromEnv(): AgentConfig {
  return {
    apiKey: readRequiredEnv("OPENAI_API_KEY"),
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    model: process.env.OPENAI_MODEL?.trim() || "MiniMax-M2.7",
    reasoningSplit: readBooleanEnv("OPENAI_REASONING_SPLIT", true),
  };
}

export class AgentSession {
  #agent: Agent;
  #conversationId: string;
  #defaults: Omit<SessionOptions, "conversationId">;

  constructor(agent: Agent, options: SessionOptions = {}) {
    this.#agent = agent;
    this.#conversationId = options.conversationId ?? randomUUID();
    this.#defaults = {
      model: options.model,
      systemPrompt: options.systemPrompt,
    };
  }

  get id() {
    return this.#conversationId;
  }

  get messages() {
    return this.#agent.getMessages(this.#conversationId);
  }

  clear() {
    this.#agent.clearConversation(this.#conversationId);
  }

  async chat(content: string, options: SessionChatOptions = {}) {
    return this.#agent.chat(
      {
        content,
        conversationId: this.#conversationId,
        role: options.role,
        model: options.model ?? this.#defaults.model,
        systemPrompt: options.systemPrompt ?? this.#defaults.systemPrompt,
      },
      options
    );
  }

  async sendToolResult(content: string, toolCallId: string, options: SessionToolResultOptions = {}) {
    return this.#agent.chat(
      {
        content,
        conversationId: this.#conversationId,
        role: "tool",
        toolCallId,
        model: options.model ?? this.#defaults.model,
        systemPrompt: options.systemPrompt ?? this.#defaults.systemPrompt,
      },
      options
    );
  }
}

export class Agent {
  #client: OpenAI;
  #config: AgentConfig;
  #conversations = new Map<string, ConversationState>();

  constructor(config: AgentConfig = loadAgentConfigFromEnv()) {
    this.#config = config;
    this.#client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  createSession(options: SessionOptions = {}) {
    return new AgentSession(this, options);
  }

  clearConversation(conversationId: string) {
    this.#conversations.delete(conversationId);
  }

  getMessages(conversationId: string) {
    const state = this.#conversations.get(conversationId);
    return cloneMessages(state?.messages ?? []);
  }

  async chat(chatRequest: ChatRequest, options: ChatOptions = {}): Promise<ChatResult> {
    const conversationId = chatRequest.conversationId ?? randomUUID();
    const state = this.#getConversation(conversationId);
    const nextMessage = toConversationMessage(chatRequest);

    this.#applyRequestContext(state, chatRequest);
    state.messages.push(nextMessage);

    let assistantContent = "";

    try {
      const stream = await this.#createStream(state);
      assistantContent = await this.#consumeStream(stream, options);
    } catch (error) {
      this.#rollbackPendingMessage(conversationId, state);
      throw error;
    }

    state.messages.push({
      role: "assistant",
      content: assistantContent,
    });

    if (options.onComplete) {
      await options.onComplete(assistantContent);
    }

    return {
      conversationId,
      content: assistantContent,
      messages: cloneMessages(state.messages),
    };
  }

  #getConversation(conversationId: string) {
    const existingConversation = this.#conversations.get(conversationId);
    if (existingConversation) {
      return existingConversation;
    }

    const nextConversation: ConversationState = {
      messages: [],
    };

    this.#conversations.set(conversationId, nextConversation);
    return nextConversation;
  }

  #applyRequestContext(state: ConversationState, chatRequest: ChatRequest) {
    if (chatRequest.model !== undefined) {
      state.model = chatRequest.model;
    }

    if (chatRequest.systemPrompt !== undefined) {
      state.systemPrompt = chatRequest.systemPrompt;
    }
  }

  async #createStream(state: ConversationState) {
    const request: StreamingChatRequest = {
      model: state.model ?? this.#config.model,
      messages: buildRequestMessages(state),
      stream: true,
      reasoning_split: this.#config.reasoningSplit,
    };

    return this.#client.chat.completions.create(request as OpenAI.ChatCompletionCreateParamsStreaming);
  }

  async #consumeStream(
    stream: AsyncIterable<{
      choices?: Array<{
        delta?: {
          content?: string | null;
        };
      }>;
    }>,
    options: ChatOptions
  ) {
    let assistantContent = "";

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (!text) {
        continue;
      }

      assistantContent += text;

      if (options.onText) {
        await options.onText(text);
      } else {
        process.stdout.write(text);
      }
    }

    return assistantContent;
  }

  #rollbackPendingMessage(conversationId: string, state: ConversationState) {
    state.messages.pop();

    if (state.messages.length === 0 && !state.model && !state.systemPrompt) {
      this.#conversations.delete(conversationId);
    }
  }
}
