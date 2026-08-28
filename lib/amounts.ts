const UNIT = 10n ** 18n;
const MAX_U256 = (1n << 256n) - 1n;

export function parseGen(value: string): bigint {
  const input = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(input)) {
    throw new Error(
      "Enter a non-negative GEN amount with at most 18 decimal places.",
    );
  }
  const [whole, fraction = ""] = input.split(".");
  const amount = BigInt(whole) * UNIT + BigInt(fraction.padEnd(18, "0"));
  if (amount > MAX_U256) throw new Error("The GEN amount is too large.");
  return amount;
}

export function formatGen(value: string | number | bigint): string {
  const amount = BigInt(value || 0);
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const fraction = (absolute % UNIT)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return sign + String(absolute / UNIT) + (fraction ? "." + fraction : "");
}
