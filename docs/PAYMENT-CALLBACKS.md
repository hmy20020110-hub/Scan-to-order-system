# 支付回调测试契约

## 目标

支付回调必须满足四个条件：来源可验证、通知不超时、金额与订单一致、重复通知不会重复入账。本项目把这些条件拆成可单元测试的纯函数和可落库的事务。

## 统一 payload

```json
{
  "orderNumber": "TABC1234",
  "transactionId": "txn-001",
  "amountCents": 2680,
  "status": "success",
  "timestamp": 1700000000000,
  "nonce": "nonce-12345678"
}
```

`status` 支持 `success`、`failed`、`refunded`。金额单位固定为分，避免浮点数误差。

## 测试签名

本地模拟支付和微信适配器测试契约使用同一个明确的签名输入顺序：

```text
provider\norderNumber\ntransactionId\namountCents\nstatus\ntimestamp\nnonce
```

使用 HMAC-SHA256 生成 64 位十六进制签名：

```ts
createPaymentSignature(provider, payload, secret)
```

验证函数会检查：

- payload 的 Zod 类型和长度。
- 时间戳与当前时间相差不超过 5 分钟。
- provider、金额、订单号、交易号等字段参与签名。
- 使用 timing-safe comparison，避免简单字符串比较。

运行测试：

```bash
pnpm test -- server/payment-callbacks.test.ts
```

测试覆盖：

- mock 回调成功。
- wechat 回调成功。
- 修改金额后签名失败。
- 回调过期。
- 错误 provider。
- 错误密钥或缺失签名。

## 业务事务

`applyPaymentCallback` 处理订单和支付流水：

1. 按 `orderNumber` 查找订单。
2. 发现同 provider + transactionId 的已有记录时，检查订单和金额一致后返回 `duplicate`。
3. 回调金额与订单总额不一致时拒绝。
4. 插入 `paymentTransactions` 记录。
5. `success` 更新订单为 `paid`，`refunded` 更新为 `refunded`，`failed` 保留原支付状态。
6. 唯一索引防止同一交易在并发请求中重复写入。

## REST 回调接口

支付平台或本地模拟器可直接调用：

```text
POST /api/payment-callbacks/mock
POST /api/payment-callbacks/wechat
Header: x-payment-signature: <64-character-hex-signature>
Body: <统一 payload JSON>
```

成功返回 `200` 和 `{ "success": true, "status": "applied" }`；重复通知仍返回成功并标记 `status=duplicate`。签名失败、订单不存在、金额不一致等情况返回对应的 4xx。

## tRPC 回调接口

```text
POST /api/trpc/payment.callback
```

请求体是 tRPC mutation 输入：

```json
{
  "provider": "mock",
  "signature": "<64-character-hex-signature>",
  "payload": {
    "orderNumber": "TABC1234",
    "transactionId": "txn-001",
    "amountCents": 2680,
    "status": "success",
    "timestamp": 1700000000000,
    "nonce": "nonce-12345678"
  }
}
```

本地模拟回调使用 `MOCK_PAYMENT_CALLBACK_SECRET`。生产环境禁止保留默认模拟密钥；模拟回调接口也不应暴露给公网。

## 微信支付适配边界

微信支付官方通知通常需要 API v3 平台证书验签和 AES-GCM 解密。本项目的 `wechat` provider 当前是**适配器测试契约**，方便先验证订单金额、时效、幂等和状态流转，不等同于官方通知解密实现。

正式上线步骤：

1. 接入微信支付官方 SDK 或经过审计的 API v3 验签/解密实现。
2. 将官方通知转换为本项目的统一 payload。
3. 通过 `validatePaymentCallback` 之后再调用 `applyPaymentCallback`，或在适配器内部复用相同业务事务。
4. 配置 HTTPS 通知地址、平台证书更新、超时重试和退款通知。
5. 用测试商户验证成功、失败、金额不一致、重复通知、退款和订单不存在等场景。

任何支付成功页面只能作为用户体验提示，最终支付状态以服务端已验证的回调或主动查询结果为准。
