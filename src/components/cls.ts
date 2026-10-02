export function cls(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
