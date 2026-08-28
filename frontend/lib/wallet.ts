export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};
export async function ensureStudionet(
  wallet: WalletProvider,
  rpcUrl: string,
  verifyRpc: () => Promise<void>,
) {
  await verifyRpc();
  const chainId = "0xf22f";
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (Number((error as { code?: unknown })?.code) !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "GenLayer Studionet",
          rpcUrls: [rpcUrl],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        },
      ],
    });
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }
  const active = await wallet.request({ method: "eth_chainId" });
  if (Number.parseInt(String(active), 16) !== 61999)
    throw new Error(
      "Switch your wallet to GenLayer Studionet before continuing.",
    );
}
export async function assertWalletAccount(
  wallet: WalletProvider,
  account: string,
) {
  const accounts = (await wallet.request({
    method: "eth_accounts",
  })) as string[];
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(account) ||
    String(accounts?.[0] ?? "").toLowerCase() !== account.toLowerCase()
  )
    throw new Error("The active wallet changed. Reconnect before submitting.");
}
