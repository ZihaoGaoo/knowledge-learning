- `interface`：定义对象结构
- `type`：更通用，能写联合、交叉、元组等
- 联合：`A | B`，二选一
- 交叉：`A & B`，都要有
- `any`：放弃类型检查
- `unknown`：先判断再用，比 `any` 安全
- 泛型：类型参数化，提高复用性
- 类型断言：告诉 TS 类型，不改变运行时值
- `extends`：继承/泛型约束
- `infer`：在条件类型里推断类型
- `never`：不可能出现的类型
- `void`：没有返回值
- 少用 `enum`，更推荐字面量联合：`"user" | "assistant"`

**高频工具类型**

- `Partial<T>`：全变可选
- `Required<T>`：全变必填
- `Readonly<T>`：全变只读
- `Pick<T, K>`：挑字段
- `Omit<T, K>`：去字段
- `Record<K, T>`：映射对象
- `ReturnType<T>`：取返回值类型
- `Parameters<T>`：取参数类型
- `NonNullable<T>`：去掉 `null/undefined`

**一句话总结**

- 对象用 `interface`
- 组合用 `type`
- 不确定用 `unknown`
- 复用靠泛型
- 裁剪结构靠 `Pick/Omit`
- 改属性修饰靠 `Partial/Required/Readonly`
