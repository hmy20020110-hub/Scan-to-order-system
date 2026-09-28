# GitHub 扫码点餐方案调研

调研时间：2026-09-28

## 结论

本次未安装或复制任何第三方仓库代码，仅借鉴数据模型、交互和运维思路。优先保持现有 tRPC + MySQL + Manus Storage 架构，逐项吸收成熟模式。

## 候选项目

1. [softenrj/qr-menu](https://github.com/softenrj/qr-menu)
   - 最直接匹配桌台二维码、顾客菜单/购物车/订单、商家面板和 Cloudinary 菜品上传思路。
   - 研究结果约 49 stars，许可证为 `Other/NOASSERTION`，README 标注教育用途；商业代码复用前需取得许可。
   - 规格选项和可靠新订单推送未被明确证明，不能直接作为生产安全基线。

2. [satisfecho/pos](https://github.com/satisfecho/pos)
   - 适合作为规格、桌台 PIN/Redis 限流、角色权限、订单状态机、WebSocket KDS 和新订单声音提醒的领域参考。
   - 研究结果约 48 stars，AGPL-3.0；大型 Angular/FastAPI/PostgreSQL/Redis 技术栈，不整体移植。
   - 其 modifiers 价格增量仍有缺口，图片更偏目录导入，不等同于商家图片上传。

3. [itzzritik/OrderWorder](https://github.com/itzzritik/OrderWorder)
   - 可参考顾客二维码菜单/购物车/订单、商家/厨房看板和实时状态交互。
   - 研究结果约 138 stars，但无明确开源许可证，README 有演示账号风险；不能直接复用生产代码。

## 本项目落地优先级

- 商家登录：服务端校验、登录失败锁定、设置修改和安全会话。
- 图片：受限 MIME/大小的服务端上传，使用现有 Manus Storage，不信任前端 URL。
- 规格：规格组/选项/价格增量，服务端验证选择与金额，订单行保存快照。
- 订单提醒：后台轮询发现新订单后弹窗和声音；后续可升级为 outbox + SSE/WebSocket。

## 复用注意

所有候选项目均需要独立审计授权隔离、图片上传、金额校验、支付 webhook、断线重连、监控和隐私合规；不得复制演示凭据或第三方密钥。
