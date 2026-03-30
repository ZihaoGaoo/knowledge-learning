import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../mcp.json"
);

type ServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type ToolDefinition = {
  server: string;
  name: string;
  description?: string;
  inputSchema?: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type Connection = {
  child: ChildProcessWithoutNullStreams;
  buffer: string;
  nextId: number;
  pending: Map<number, PendingRequest>;
  ready: Promise<void>;
};

function asObject(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }

  return value as Record<string, unknown>;
}

function readConfig() {
  const configPath = resolve(process.env.MCP_CONFIG_PATH || DEFAULT_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return { mcpServers: {} as Record<string, ServerConfig> };
  }

  return JSON.parse(readFileSync(configPath, "utf8")) as {
    mcpServers?: Record<string, ServerConfig>;
  };
}

function resolveEnv(env?: Record<string, string>) {
  if (!env) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      const match = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
      return [key, match ? process.env[match[1]] ?? "" : value];
    })
  );
}

function extractText(result: Record<string, unknown>) {
  if (!Array.isArray(result.content)) {
    return undefined;
  }

  const parts = result.content
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        item.type === "text" &&
        typeof item.text === "string"
    )
    .map((item) => (item as { text: string }).text.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : undefined;
}

export default class McpClientManager {
  #servers = readConfig().mcpServers ?? {};
  #connections = new Map<string, Connection>();

  get enabled() {
    return Object.keys(this.#servers).length > 0;
  }

  listServers() {
    return Object.keys(this.#servers);
  }

  async listTools(server?: string): Promise<ToolDefinition[]> {
    const serverNames = server ? [server] : this.listServers();
    const pages = await Promise.all(serverNames.map((name) => this.#listServerTools(name)));
    return pages.flat();
  }

  async callTool(server: string, tool: string, args?: Record<string, unknown>) {
    const result = asObject(
      await this.#request(server, "tools/call", {
        name: tool,
        arguments: args,
      }),
      `tools/call result from ${server}`
    );

    return {
      server,
      tool,
      isError: Boolean(result.isError),
      text: extractText(result),
      structuredContent: result.structuredContent,
      raw: result,
    };
  }

  async #listServerTools(server: string) {
    const tools: ToolDefinition[] = [];
    let cursor: string | undefined;

    while (true) {
      const result = asObject(
        await this.#request(server, "tools/list", cursor ? { cursor } : {}),
        `tools/list result from ${server}`
      );

      for (const item of Array.isArray(result.tools) ? result.tools : []) {
        const tool = asObject(item, `tool definition from ${server}`);
        if (typeof tool.name !== "string") {
          continue;
        }

        tools.push({
          server,
          name: tool.name,
          description: typeof tool.description === "string" ? tool.description : undefined,
          inputSchema:
            tool.inputSchema &&
            typeof tool.inputSchema === "object" &&
            !Array.isArray(tool.inputSchema)
              ? (tool.inputSchema as ToolDefinition["inputSchema"])
              : undefined,
        });
      }

      cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
      if (!cursor) {
        return tools;
      }
    }
  }

  async #request(server: string, method: string, params?: Record<string, unknown>) {
    const connection = await this.#getConnection(server);
    return this.#send(connection, server, method, params);
  }

  async #getConnection(server: string) {
    const config = this.#servers[server];
    if (!config) {
      throw new Error(`MCP server "${server}" is not configured`);
    }

    const existing = this.#connections.get(server);
    if (existing) {
      await existing.ready;
      return existing;
    }

    const child = spawn(config.command, config.args ?? [], {
      stdio: "pipe",
      env: {
        ...process.env,
        ...resolveEnv(config.env),
      },
    });

    const connection: Connection = {
      child,
      buffer: "",
      nextId: 1,
      pending: new Map(),
      ready: Promise.resolve(),
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      connection.buffer += chunk;
      this.#readMessages(server, connection);
    });

    child.on("error", (error) => {
      this.#closeConnection(server, connection, new Error(`Failed to start MCP server "${server}": ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      this.#closeConnection(
        server,
        connection,
        new Error(`MCP server "${server}" exited (${signal ?? code ?? "unknown"})`)
      );
    });

    connection.ready = this.#initialize(server, connection).catch((error) => {
      this.#closeConnection(server, connection, error instanceof Error ? error : new Error(String(error)));
      throw error;
    });

    this.#connections.set(server, connection);
    await connection.ready;
    return connection;
  }

  async #initialize(server: string, connection: Connection) {
    const result = asObject(
      await this.#send(connection, server, "initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "knowledge-learning-agent",
          version: "0.1.0",
        },
      }),
      `initialize result from ${server}`
    );

    if (typeof result.protocolVersion !== "string" || !result.protocolVersion) {
      throw new Error(`MCP server "${server}" did not return a protocol version`);
    }

    connection.child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`
    );
  }

  async #send(
    connection: Connection,
    server: string,
    method: string,
    params?: Record<string, unknown>
  ) {
    if (!connection.child.stdin) {
      throw new Error(`MCP server "${server}" is not running`);
    }

    const id = connection.nextId++;
    const response = new Promise<unknown>((resolve, reject) => {
      connection.pending.set(id, { resolve, reject });
    });

    connection.child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
    );

    return response;
  }

  #readMessages(server: string, connection: Connection) {
    while (true) {
      const newlineIndex = connection.buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = connection.buffer.slice(0, newlineIndex).trim();
      connection.buffer = connection.buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      let message: Record<string, unknown>;
      try {
        message = asObject(JSON.parse(line), `MCP message from ${server}`);
      } catch {
        continue;
      }

      if (typeof message.id !== "number") {
        continue;
      }

      const pending = connection.pending.get(message.id);
      if (!pending) {
        continue;
      }

      connection.pending.delete(message.id);

      if (message.error) {
        const error = asObject(message.error, `MCP error from ${server}`);
        pending.reject(
          new Error(
            `MCP ${server} error ${String(error.code ?? "unknown")}: ${String(error.message ?? "Unknown error")}`
          )
        );
      } else {
        pending.resolve(message.result);
      }
    }
  }

  #closeConnection(server: string, connection: Connection, error: Error) {
    if (this.#connections.get(server) === connection) {
      this.#connections.delete(server);
    }

    for (const pending of connection.pending.values()) {
      pending.reject(error);
    }

    connection.pending.clear();
  }
}
