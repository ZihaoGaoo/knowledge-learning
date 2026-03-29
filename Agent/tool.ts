import type OpenAI from "openai";

export type ToolHandler = (input?: unknown) => Promise<unknown> | unknown;

export type ToolInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type Tool = {
  name: string;
  description?: string;
  inputSchema?: ToolInputSchema;
  execute: ToolHandler;
};

export default class ToolManager {
  #tools = new Map<string, Tool>();

  register(tool: Tool) {
    const name = tool.name.trim();

    if (!name) {
      throw new Error("Tool name is required");
    }

    if (this.#tools.has(name)) {
      throw new Error(`Tool "${name}" already exists`);
    }

    this.#tools.set(name, {
      ...tool,
      name,
    });
  }

  list() {
    return Array.from(this.#tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  hasTools() {
    return this.#tools.size > 0;
  }

  toOpenAITools(): OpenAI.ChatCompletionTool[] {
    return Array.from(this.#tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema ?? {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    }));
  }

  async execute(name: string, input?: unknown) {
    const tool = this.#tools.get(name.trim());

    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }

    return tool.execute(input);
  }
}
