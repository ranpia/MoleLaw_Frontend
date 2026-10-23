export function validatePassword(value: string) {
  return value.trim().length > 0 && value.length >= 8 && value.length <= 72 && new TextEncoder().encode(value).length <= 72;
}
export function validateQuestion(value: string): string | null {
  if (!value.trim()) return "질문을 입력해 주세요.";
  if ([...value].length > 2000 || new TextEncoder().encode(value).length > 32 * 1024) return "질문은 2,000자 및 UTF-8 32KiB 이내로 입력해 주세요.";
  return null;
}
