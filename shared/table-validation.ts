export const TABLE_CODE_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateTableInput(input: { name: string; code: string }): string | null {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) return "请输入桌台名称";
  if (code.length < 2 || !TABLE_CODE_PATTERN.test(code)) {
    return "桌台码至少 2 位，只能包含字母、数字、下划线和短横线";
  }
  return null;
}
