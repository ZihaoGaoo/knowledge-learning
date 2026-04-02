# Thrift 小场景

这里把前面的“订单服务调用库存服务”场景，改成一个更像真实工程的 `Apache Thrift` 版本。

这次的重点不再是手写 `JSON-RPC` 请求体，而是学习 Thrift 的完整链路：

1. 先写接口定义文件 `.thrift`
2. 用 `thrift` 编译器生成 `gen-nodejs`
3. 服务端实现生成出来的接口
4. 客户端像调本地方法一样去调用远程服务

## Thrift 在这个例子里做了什么

Thrift 帮你统一了三件事：

- 接口定义
- 数据结构定义
- 客户端 / 服务端代码生成

所以它比手写 JSON-RPC 更“工程化”。

## 目录

```text
node
├── thrift.md
└── thrift-demo
    ├── client.js
    ├── gen-nodejs
    ├── inventory.thrift
    ├── package.json
    └── server.js
```

## 业务场景

还是那个最小电商例子：

- `order-service` 下单前先问 `inventory-service`
- 如果库存够，调用 `deduct`
- 如果库存不够，服务端抛出一个 `InsufficientStockException`

这个例子很适合学习 Thrift，因为你能同时看到：

- `struct`
- `exception`
- `service`
- 代码生成

## 关键接口定义

在 [inventory.thrift](/Users/gaozihao/Project/knowledge-learning/node/thrift-demo/inventory.thrift) 里我们定义了：

- `StockInfo`
- `DeductResult`
- `InsufficientStockException`
- `InventoryService`

和手写 HTTP API 最大的区别是：

- 这里先定义“服务契约”
- 然后再生成代码

## 如何生成代码

在 `node/thrift-demo` 目录执行：

```bash
thrift -r --gen js:node inventory.thrift
```

这个命令会生成 `gen-nodejs` 目录，里面是 Node 可直接 `require` 的客户端 / 服务端桩代码。

## 如何运行

先安装依赖：

```bash
cd node/thrift-demo
pnpm install
```

启动服务端：

```bash
node server.js
```

另开一个终端运行客户端：

```bash
node client.js
```

客户端会依次演示三件事：

- 一次正常下单
- 一次“下单前就发现库存不够”的业务判断
- 一次直接调用 `deduct` 并触发 `InsufficientStockException`

这个 demo 的库存数据存在服务端内存里，所以每次跑完客户端后库存都会变化。
如果你想回到初始状态，重启服务端即可。

## 你应该重点看什么

1. `.thrift` 文件就是服务之间的“合同”。
2. `gen-nodejs` 不是你手写的，而是编译器生成的。
3. 服务端实现的是“接口方法”，不是自己自由拼 HTTP 路由。
4. 客户端拿到的是一个 `InventoryService` client，看起来很像在调本地函数。

## 和前一个 JSON-RPC 例子的区别

- JSON-RPC 版：
  - 你要自己设计请求格式
  - 自己解析方法名
  - 自己包装错误对象

- Thrift 版：
  - 接口和类型先写在 IDL 里
  - 生成代码后，调用和处理都更标准
  - 更适合跨语言和多服务协作

## 什么时候适合用 Thrift

如果是：

- 公司内部微服务
- 多语言服务通信
- 强类型接口约束
- 希望统一代码生成

Thrift 就会比手写 HTTP/JSON 更舒服。

如果是：

- 对外开放 API
- 需要浏览器直接调试
- 更偏前后端接口

通常还是 REST 更常见。
