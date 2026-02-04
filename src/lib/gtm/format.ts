export function formatUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
