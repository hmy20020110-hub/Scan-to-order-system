export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  merchantLoginCode: process.env.MERCHANT_LOGIN_CODE ?? "20020110",
  wechatPaymentCallbackSecret: process.env.WECHAT_PAYMENT_CALLBACK_SECRET ?? "",
  mockPaymentCallbackSecret:
    process.env.MOCK_PAYMENT_CALLBACK_SECRET ?? "local-mock-payment-secret",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
