/**
 * A Partner App scope as a plain sentence for merchants ("هيقدر يشوف
 * طلباتك"), from the `appScopes.*` strings. Unknown scopes show as-is.
 */
export function scopeSentence(
  t: (key: string, options?: Record<string, unknown>) => string,
  scope: string,
): string {
  return t(`appScopes.${scope.replace(":", "_")}`, { defaultValue: scope });
}
