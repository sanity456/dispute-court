type NativePayout = { contract: string; recipient: string; amount: bigint };
export function nativePayoutDelivered(value: unknown, expected: NativePayout): boolean {
  if (!value || typeof value !== "object") return false;
  const tx=value as Record<string,unknown>;
  const status=String(tx.status_name ?? tx.statusName ?? tx.status).toUpperCase();
  if (status!=="FINALIZED" && status!=="7") return false;
  if ((tx.type!==0 && tx.type!=="0") || tx.value_credited!==true) return false;
  if (String(tx.from_address ?? tx.from ?? "").toLowerCase()!==expected.contract.toLowerCase()) return false;
  if (String(tx.to_address ?? tx.to ?? "").toLowerCase()!==expected.recipient.toLowerCase()) return false;
  if (typeof tx.value==="number" && !Number.isSafeInteger(tx.value)) return false;
  try {return expected.amount>0n && BigInt(String(tx.value))===expected.amount;} catch {return false;}
}
