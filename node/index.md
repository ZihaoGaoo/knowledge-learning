**基础原理**
- Node.js 是什么？和浏览器 JS 有什么区别？
- Node.js 为什么适合 I/O 密集型，不适合 CPU 密集型？
- Node.js 的单线程指的是什么？
- Node.js 底层架构了解吗？`V8`、`libuv` 分别做什么？
- 进程和线程的区别是什么？

**事件循环 / 异步**
- 什么是事件循环（Event Loop）？
- 宏任务和微任务的执行顺序是什么？
- `process.nextTick()`、`Promise.then()`、`setTimeout()`、`setImmediate()` 的区别？
- Node 中异步 I/O 是怎么实现的？
- 回调地狱怎么解决？

**模块机制**
- `CommonJS` 和 `ES Module` 的区别？
- `require` 和 `import` 的区别？
- 模块缓存机制是怎样的？
- 循环依赖会发生什么？

**核心 API**
- `fs`、`path`、`http`、`os`、`events` 常用方法有哪些？
- `Buffer` 是什么？和字符串、流是什么关系？
- `Stream` 有哪几种？`pipe` 的原理是什么？
- `EventEmitter` 怎么用？有哪些注意点？

**网络 / HTTP**
- Node 如何创建一个 HTTP 服务？
- HTTP 和 HTTPS 的区别？
- TCP、UDP、HTTP、WebSocket 的区别？
- 什么是 RPC？RPC 和 HTTP API 的区别是什么？
- 如果让你用 Node 写一个 RPC 小场景，你会怎么设计“订单服务调用库存服务”？
- Thrift 是什么？为什么它也属于 RPC 体系？
- 如果让你用 `.thrift` 文件定义一个库存服务，你会怎么设计 `struct`、`exception` 和 `service`？
- 长连接和短连接是什么？
- 如何实现文件上传、下载、断点续传？

**Express / Koa**
- Express 和 Koa 的区别？
- Koa 的洋葱模型是什么？
- 中间件原理是什么？怎么自己实现一个中间件？
- `next()` 在 Koa 中做了什么？
- 如何统一处理异常和日志？

**性能优化**
- Node 应用性能瓶颈一般在哪？
- 如何做性能分析？用过 `clinic`、`heapdump`、`profiler` 吗？
- 内存泄漏怎么排查？
- 如何优化接口响应速度？
- 大文件处理为什么推荐流而不是一次性读入内存？

**多进程 / 集群**
- Node 是单线程，为什么还能处理高并发？
- `cluster` 的作用是什么？
- `child_process` 有哪些方法？
- `worker_threads` 和 `child_process` 的区别？
- PM2 的作用是什么？

**数据库 / 缓存**
- Node 怎么连接 MySQL / MongoDB / Redis？
- 连接池为什么重要？
- Redis 常见使用场景有哪些？
- 如何防止缓存穿透、击穿、雪崩？

**安全**
- 常见 Node 安全问题有哪些？
- SQL 注入、XSS、CSRF 怎么防？
- JWT 的原理和风险是什么？
- 密码为什么不能明文存储？一般怎么加密？

**工程化**
- package.json 里常见字段有哪些？
- `dependencies` 和 `devDependencies` 的区别？
- `npm`、`yarn`、`pnpm` 有什么区别？
- 如何做接口鉴权、参数校验、错误码设计？
- Node 项目如何做日志、监控、部署？

**高频手写题**
- 手写一个简单的 `Promise` 封装异步函数
- 手写中间件执行模型
- 手写发布订阅 `EventEmitter`
- 手写一个静态资源服务器
- 手写文件流拷贝
- 手写并发控制函数
