import type OpenAI from "openai";

export type StreamingChatRequest = OpenAI.ChatCompletionCreateParamsStreaming & {
  reasoning_split?: boolean;
};

export type AgentMessage = OpenAI.ChatCompletionMessageParam;

export type AgentConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
  reasoningSplit: boolean;
};

export type UserChatRequest = {
  content: string;
  conversationId?: string;
  role?: "user";
  systemPrompt?: string;
  model?: string;
};

export type ToolChatRequest = {
  content: string;
  conversationId?: string;
  role: "tool";
  toolCallId: string;
  systemPrompt?: string;
  model?: string;
};

export type ChatRequest = UserChatRequest | ToolChatRequest;

export type ChatOptions = {
  onText?: (text: string) => void | Promise<void>;
  onComplete?: (message: string) => void | Promise<void>;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  rounds: number;
};

export type ChatResult = {
  conversationId: string;
  content: string;
  messages: AgentMessage[];
  usage?: TokenUsage;
};

export type ConversationState = {
  messages: AgentMessage[];
  model?: string;
  systemPrompt?: string;
};

export type SessionOptions = {
  conversationId?: string;
  model?: string;
  systemPrompt?: string;
};

export type SessionChatOptions = Omit<UserChatRequest, "content" | "conversationId"> & ChatOptions;

export type SessionToolResultOptions = Omit<ToolChatRequest, "content" | "conversationId" | "toolCallId" | "role"> &
  ChatOptions;

export type ChatCommandOptions = {
  typing: boolean;
};
