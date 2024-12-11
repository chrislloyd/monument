export default function remember(message: string): string | null {
  let value = localStorage.getItem(message);
  if (value) {
    return value;
  }
  value = globalThis.prompt(message);
  if (!value) {
    return null;
  }
  localStorage.setItem(message, value);
  return value;
}
