# RPC 小场景

这里用一个很小的电商场景说明 RPC 是怎么工作的：

- `order-service` 要下单
- 但下单前必须先调用远程的 `inventory-service`
- 远程执行两个方法：
  - `inventory.getStock`
  - `inventory.deduct`

这个例子使用的是 `JSON-RPC 2.0 + HTTP`，这样比较容易看清 RPC 的核心：

- 调用方只关心“我要调用哪个方法、传什么参数”
- 被调用方负责在远端真正执行方法
- 返回值看起来像“本地函数执行结果”，但其实是一次网络调用

## 为什么这算 RPC

如果是普通 HTTP 风格，你可能会设计：

- `GET /inventory/:sku`
- `POST /inventory/deduct`

RPC 更像是：

- 调 `inventory.getStock({ sku })`
- 调 `inventory.deduct({ sku, quantity })`

重点从“资源”变成了“远程方法”。

## 目录

```text
node
├── rpc.md
└── rpc-demo
    ├── client.js
    └── server.js
```

## 场景说明

假设用户要买一个键盘：

1. 订单服务先远程调用库存服务的 `inventory.getStock`
2. 如果库存够，就再调用 `inventory.deduct`
3. 如果库存不足，就直接返回下单失败

这个流程在业务里非常常见：

- 下单服务调用库存服务
- 订单服务调用支付服务
- 评论服务调用用户服务

## 如何运行

先启动服务端：

```bash
node node/rpc-demo/server.js
```

再开一个终端运行客户端：

```bash
node node/rpc-demo/client.js
```

## 一次请求长什么样

客户端发给服务端的请求：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "inventory.getStock",
  "params": {
    "sku": "keyboard"
  }
}
```

服务端返回：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sku": "keyboard",
    "stock": 2
  }
}
```

如果库存不足，会返回错误对象：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": 4001,
    "message": "Insufficient stock",
    "data": {
      "sku": "keyboard",
      "requested": 3,
      "available": 2
    }
  }
}
```

## 这个例子想让你看懂什么

你可以重点观察这几件事：

1. 客户端并不知道远端怎么存库存，它只知道要调用哪个方法。
2. 服务端把“方法名 -> 实际函数”做了一层映射。
3. 错误不是直接 throw 给客户端，而是被包装成统一的 RPC error。
4. 本地写代码时像调用函数，但底层其实是序列化、网络传输、反序列化。

## 和面试里常说的 RPC 有什么关系

这个例子是最小版原理模型。真正线上 RPC 框架通常还会继续补：

- 服务注册与发现
- 超时控制
- 重试
- 熔断
- 负载均衡
- tracing
- 序列化协议优化

但核心思想没有变：

- 调远程方法
- 统一请求和响应协议
- 让跨服务调用尽量像本地调用

## 什么时候适合讲这个例子

如果面试官问：

- 什么是 RPC？
- RPC 和 HTTP API 的区别？
- Node 里怎么模拟一个 RPC？

你就可以直接拿这个“订单服务调用库存服务”的例子来讲。
