namespace js inventory

struct StockInfo {
  1: string sku,
  2: i32 stock
}

struct DeductResult {
  1: string sku,
  2: i32 deducted,
  3: i32 stock
}

exception InsufficientStockException {
  1: string sku,
  2: i32 requested,
  3: i32 available,
  4: string message
}

service InventoryService {
  StockInfo getStock(1: string sku),
  DeductResult deduct(1: string sku, 2: i32 quantity)
    throws (1: InsufficientStockException insufficient)
}
