const http = require("http");

let requestId = 1;

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: requestId++,
      method,
      params,
    });

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: "/rpc",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";

        res.on("data", (chunk) => {
          raw += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(raw);
            if (response.error) {
              const error = new Error(response.error.message);
              error.code = response.error.code;
              error.data = response.error.data;
              reject(error);
              return;
            }
            resolve(response.result);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function placeOrder({ sku, quantity }) {
  console.log(`\nplacing order, sku=${sku}, quantity=${quantity}`);

  const stockInfo = await rpcCall("inventory.getStock", { sku });
  console.log("remote getStock result:", stockInfo);

  if (stockInfo.stock < quantity) {
    console.log("order rejected before deduct: not enough stock");
    return;
  }

  const deductResult = await rpcCall("inventory.deduct", { sku, quantity });
  console.log("remote deduct result:", deductResult);
  console.log("order created successfully");
}

async function main() {
  try {
    await placeOrder({ sku: "keyboard", quantity: 1 });
    await placeOrder({ sku: "keyboard", quantity: 2 });
  } catch (error) {
    console.error("rpc call failed:", {
      message: error.message,
      code: error.code,
      data: error.data,
    });
  }
}

main();
