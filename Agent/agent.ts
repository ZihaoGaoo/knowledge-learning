import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import McpClientManager from "./mcp.js";
import ToolManager from "./tool.js";
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
  TokenUsage,
} from "./types.js";

const TOOL_SYSTEM_PROMPT =
  "Use tools when you need private or document-backed knowledge. If the user asks about anything you do not know, are unsure about, cannot verify from the current conversation, or that may exist in the knowledge base, automatically search before answering. For unfamiliar names, people, products, companies, terms, policies, internal facts, or current web information, prefer using the available search or external tools first. Answer directly only when you are confident no tool lookup is needed. If a tool result is insufficient, say so instead of guessing.";
const MAX_TOOL_ROUNDS = 5;

type RetrievalClient = {
  enabled: boolean;
  search: (query: string) => Promise<unknown[]>;
};

type CompletionLoopResult = {
  content: string;
  usage?: TokenUsage;
};

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

function buildRequestMessages(
  state: ConversationState,
  includeToolGuidance: boolean
): AgentMessage[] {
  const messages: AgentMessage[] = [];

  if (includeToolGuidance) {
    messages.push({
      role: "system",
      content: TOOL_SYSTEM_PROMPT,
    });
  }

  if (state.systemPrompt) {
    messages.push({
      role: "system",
      content: state.systemPrompt,
    });
  }

  messages.push(...state.messages);
  return messages;
}

function normalizeAssistantContent(content: string | null | undefined) {
  return typeof content === "string" ? content : "";
}

function normalizeToolName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "tool";
  }

  return /^[a-z_]/.test(normalized) ? normalized : `tool_${normalized}`;
}

function parseToolInput(toolName: string, rawArguments: string) {
  if (!rawArguments.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawArguments);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Invalid arguments for tool "${toolName}": ${message}`);
  }
}

function serializeToolResult(result: unknown) {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

function normalizeUsage(
  usage: OpenAI.CompletionUsage | undefined,
  rounds: number
): TokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    rounds,
  };
}

function mergeUsage(
  current: TokenUsage | undefined,
  next: TokenUsage | undefined
) {
  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  return {
    promptTokens: current.promptTokens + next.promptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens,
    rounds: current.rounds + next.rounds,
  };
}

function isFunctionToolCall(
  toolCall: OpenAI.ChatCompletionMessageToolCall
): toolCall is OpenAI.ChatCompletionMessageFunctionToolCall {
  return toolCall.type === "function";
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

  async sendToolResult(
    content: string,
    toolCallId: string,
    options: SessionToolResultOptions = {}
  ) {
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
  #tools = new ToolManager();
  #mcp = new McpClientManager();
  #mcpToolsLoaded?: Promise<void>;
  #retrievalEnabled = readBooleanEnv("PGVECTOR_ENABLED", false);
  #retrieval?: Promise<RetrievalClient>;

  constructor(config: AgentConfig = loadAgentConfigFromEnv()) {
    this.#config = config;
    this.#client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.#registerBuiltInTools();
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

  async chat(
    chatRequest: ChatRequest,
    options: ChatOptions = {}
  ): Promise<ChatResult> {
    const conversationId = chatRequest.conversationId ?? randomUUID();
    const state = this.#getConversation(conversationId);
    const initialMessageCount = state.messages.length;
    const nextMessage = toConversationMessage(chatRequest);

    this.#applyRequestContext(state, chatRequest);
    state.messages.push(nextMessage);

    let assistantContent = "";
    let usage: TokenUsage | undefined;

    try {
      const result = await this.#runCompletionLoop(state, options);
      assistantContent = result.content;
      usage = result.usage;
    } catch (error) {
      this.#rollbackConversation(conversationId, state, initialMessageCount);
      throw error;
    }

    if (options.onComplete) {
      await options.onComplete(assistantContent);
    }

    return {
      conversationId,
      content: assistantContent,
      messages: cloneMessages(state.messages),
      usage,
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

  #registerBuiltInTools() {
    if (!this.#retrievalEnabled) {
      return;
    }

    this.#tools.register({
      name: "search_knowledge_base",
      description:
        "Automatically search the private knowledge base whenever the answer may depend on unknown, uncertain, domain-specific, document-backed, company-specific, person-specific, product-specific, or internal information. Use this tool before answering when you are missing facts or are not confident in the answer.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to run against the knowledge base.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const query =
          typeof input === "object" &&
          input !== null &&
          "query" in input &&
          typeof input.query === "string"
            ? input.query.trim()
            : "";

        if (!query) {
          throw new Error(
            'Tool "search_knowledge_base" requires a non-empty "query".'
          );
        }

        const retrieval = await this.#getRetrieval();
        const results = await retrieval.search(query);
        return {
          query,
          count: results.length,
          results,
        };
      },
    });
  }

  async #ensureMcpToolsRegistered() {
    if (!this.#mcp.enabled) {
      return;
    }

    if (!this.#mcpToolsLoaded) {
      this.#mcpToolsLoaded = this.#loadMcpTools().catch((error) => {
        this.#mcpToolsLoaded = undefined;
        throw error;
      });
    }

    await this.#mcpToolsLoaded;
  }

  async #loadMcpTools() {
    const tools = await this.#mcp.listTools();
    const nameCounts = new Map<string, number>();

    for (const tool of tools) {
      const normalizedName = normalizeToolName(tool.name);
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
    }

    for (const tool of tools) {
      const normalizedName = normalizeToolName(tool.name);
      const serverPrefix = normalizeToolName(tool.server);
      const baseName =
        (nameCounts.get(normalizedName) ?? 0) > 1
          ? `${serverPrefix}__${normalizedName}`
          : normalizedName;

      let exposedName = baseName;
      let suffix = 2;
      while (this.#tools.has(exposedName)) {
        exposedName = `${baseName}_${suffix}`;
        suffix += 1;
      }

      this.#tools.register({
        name: exposedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input) => {
          const args =
            typeof input === "object" && input !== null && !Array.isArray(input)
              ? (input as Record<string, unknown>)
              : undefined;

          return this.#mcp.callTool(tool.server, tool.name, args);
        },
      });
    }
  }

  async #getRetrieval(): Promise<RetrievalClient> {
    if (!this.#retrieval) {
      this.#retrieval = import("./retrieval.js")
        .then(({ PostgresRetrieval }) => new PostgresRetrieval())
        .then((retrieval) => {
          if (!retrieval.enabled) {
            throw new Error("Knowledge base retrieval is disabled.");
          }

          return retrieval;
        })
        .catch((error) => {
          this.#retrieval = undefined;
          const message =
            error instanceof Error
              ? error.message
              : "Unknown retrieval initialization error";
          throw new Error(
            `Failed to initialize knowledge base retrieval: ${message}`
          );
        });
    }

    return this.#retrieval;
  }

  async #runCompletionLoop(
    state: ConversationState,
    options: ChatOptions
  ): Promise<CompletionLoopResult> {
    let totalUsage: TokenUsage | undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await this.#createCompletion(state);
      const message = completion.choices[0]?.message;
      totalUsage = mergeUsage(totalUsage, normalizeUsage(completion.usage, 1));

      if (!message) {
        break;
      }

      const functionToolCalls =
        message.tool_calls?.filter(isFunctionToolCall) ?? [];

      if (functionToolCalls.length) {
        state.messages.push({
          role: "assistant",
          content: normalizeAssistantContent(message.content) || null,
          tool_calls: functionToolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          })),
        });

        process.stdout.write(
          `> 当前调用tool: ${functionToolCalls.map((tool) => tool.function.name)}\n`
        );

        const toolMessages = await this.#executeToolCalls(functionToolCalls);
        state.messages.push(...toolMessages);
        continue;
      }

      const assistantContent = normalizeAssistantContent(message.content);

      state.messages.push({
        role: "assistant",
        content: assistantContent,
      });

      if (assistantContent) {
        if (options.onText) {
          await options.onText(assistantContent);
        } else {
          process.stdout.write(assistantContent);
        }
      }

      return {
        content: assistantContent,
        usage: totalUsage,
      };
    }

    throw new Error(`Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds.`);
  }

  async #createCompletion(state: ConversationState) {
    await this.#ensureMcpToolsRegistered();

    const tools = this.#tools.toOpenAITools();
    const request = {
      model: state.model ?? this.#config.model,
      messages: buildRequestMessages(state, this.#tools.hasTools()),
      reasoning_split: this.#config.reasoningSplit,
      ...(tools.length > 0
        ? {
            tools,
            tool_choice: "auto" as const,
          }
        : {}),
    };

    return this.#client.chat.completions.create(
      request as OpenAI.ChatCompletionCreateParamsNonStreaming
    );
  }

  async #executeToolCalls(
    toolCalls: OpenAI.ChatCompletionMessageFunctionToolCall[]
  ) {
    return Promise.all(
      toolCalls.map(async (toolCall) => {
        try {
          const input = parseToolInput(
            toolCall.function.name,
            toolCall.function.arguments
          );
          const result = await this.#tools.execute(
            toolCall.function.name,
            input
          );

          return {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: serializeToolResult(result),
          };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown tool execution error";
          return {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: message,
            }),
          };
        }
      })
    );
  }

  #rollbackConversation(
    conversationId: string,
    state: ConversationState,
    initialMessageCount: number
  ) {
    state.messages.splice(initialMessageCount);

    if (state.messages.length === 0 && !state.model && !state.systemPrompt) {
      this.#conversations.delete(conversationId);
    }
  }
}
