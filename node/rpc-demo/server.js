const http = require("http");

const stockBySku = new Map([
  ["keyboard", 2],
  ["mouse", 5],
  ["monitor", 1],
]);

function createRpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  return error;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(createRpcError(-32700, "Parse error"));
      }
    });

    req.on("error", reject);
  });
}

function assertString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createRpcError(-32602, `Invalid params: '${field}' must be a non-empty string`);
  }
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw createRpcError(-32602, `Invalid params: '${field}' must be a positive integer`);
  }
}

const methods = {
  "inventory.getStock": ({ sku }) => {
    assertString(sku, "sku");
    return {
      sku,
      stock: stockBySku.get(sku) ?? 0,
    };
  },
  "inventory.deduct": ({ sku, quantity }) => {
    assertString(sku, "sku");
    assertPositiveInteger(quantity, "quantity");

    const currentStock = stockBySku.get(sku) ?? 0;
    if (currentStock < quantity) {
      throw createRpcError(4001, "Insufficient stock", {
        sku,
        requested: quantity,
        available: currentStock,
      });
    }

    const nextStock = currentStock - quantity;
    stockBySku.set(sku, nextStock);

    return {
      sku,
      deducted: quantity,
      stock: nextStock,
    };
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/rpc") {
    sendJson(res, 404, { message: "Use POST /rpc" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: error.code ?? -32603,
        message: error.message ?? "Internal error",
      },
    });
    return;
  }

  const { jsonrpc, id, method, params = {} } = body;

  if (jsonrpc !== "2.0" || typeof method !== "string") {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32600,
        message: "Invalid Request",
      },
    });
    return;
  }

  const handler = methods[method];
  if (!handler) {
    sendJson(res, 404, {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    });
    return;
  }

  try {
    const result = await handler(params);
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result,
    });
  } catch (error) {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id,
      error: {
        code: error.code ?? -32603,
        message: error.message ?? "Internal error",
        data: error.data,
      },
    });
  }
});

server.listen(3001, () => {
  console.log("inventory rpc server listening on http://localhost:3001/rpc");
});
