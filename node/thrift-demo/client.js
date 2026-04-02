const thrift = require("thrift");
const InventoryService = require("./gen-nodejs/InventoryService");

const connection = thrift.createConnection("127.0.0.1", 9090, {
  transport: thrift.TBufferedTransport,
  protocol: thrift.TBinaryProtocol,
});

connection.on("error", (error) => {
  console.error("connection error:", error.message);
});

const client = thrift.createClient(InventoryService, connection);

function getStock(sku) {
  return new Promise((resolve, reject) => {
    client.getStock(sku, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

function deduct(sku, quantity) {
  return new Promise((resolve, reject) => {
    client.deduct(sku, quantity, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

async function placeOrder({ sku, quantity }) {
  console.log(`\nplacing order with thrift, sku=${sku}, quantity=${quantity}`);

  const stockInfo = await getStock(sku);
  console.log("getStock result:", stockInfo);

  if (stockInfo.stock < quantity) {
    console.log("order rejected before deduct: not enough stock");
    return;
  }

  const deductResult = await deduct(sku, quantity);
  console.log("deduct result:", deductResult);
  console.log("order created successfully");
}

async function main() {
  try {
    await placeOrder({ sku: "keyboard", quantity: 1 });
    await placeOrder({ sku: "keyboard", quantity: 2 });

    console.log("\ncalling deduct directly to trigger a thrift exception");
    await deduct("keyboard", 2);
  } catch (error) {
    console.error("thrift call failed:", {
      name: error.name,
      message: error.message,
      sku: error.sku,
      requested: error.requested,
      available: error.available,
    });
  } finally {
    connection.end();
  }
}

main();
