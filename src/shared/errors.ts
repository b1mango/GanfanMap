export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback
}
