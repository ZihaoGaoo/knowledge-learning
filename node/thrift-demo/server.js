const thrift = require("thrift");
const InventoryService = require("./gen-nodejs/InventoryService");
const types = require("./gen-nodejs/inventory_types");

const stockBySku = new Map([
  ["keyboard", 2],
  ["mouse", 5],
  ["monitor", 1],
]);

function assertString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

const handler = {
  getStock(sku, result) {
    try {
      assertString(sku, "sku");
      const stock = stockBySku.get(sku) ?? 0;
      result(null, new types.StockInfo({ sku, stock }));
    } catch (error) {
      result(error);
    }
  },

  deduct(sku, quantity, result) {
    try {
      assertString(sku, "sku");
      assertPositiveInteger(quantity, "quantity");

      const currentStock = stockBySku.get(sku) ?? 0;
      if (currentStock < quantity) {
        result(
          new types.InsufficientStockException({
            sku,
            requested: quantity,
            available: currentStock,
            message: "Insufficient stock",
          })
        );
        return;
      }

      const nextStock = currentStock - quantity;
      stockBySku.set(sku, nextStock);

      result(
        null,
        new types.DeductResult({
          sku,
          deducted: quantity,
          stock: nextStock,
        })
      );
    } catch (error) {
      result(error);
    }
  },
};

const server = thrift.createServer(InventoryService, handler, {
  transport: thrift.TBufferedTransport,
  protocol: thrift.TBinaryProtocol,
});

server.listen(9090, "127.0.0.1", () => {
  console.log("thrift inventory server listening on 127.0.0.1:9090");
});
