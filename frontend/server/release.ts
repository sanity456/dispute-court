import type { Network } from "./network.ts";
import { ApiError } from "./security.ts";
import { isRecoveryMethod, isSecurityRelease } from "../lib/release-policy.ts";

export async function requireSecurityRelease(
  network: Network,
  target: string,
  method: string,
) {
  const core = target.toLowerCase() === network.coreAddress.toLowerCase();
  if (core && isRecoveryMethod(method)) return;
  const configuration = await network.read("get_config", [], target);
  if (!isSecurityRelease(configuration))
    throw new ApiError(
      409,
      "Security update pending. New commitments are paused; existing-fund recovery remains available.",
      "security_update_required",
    );
  if (!core) {
    const helper = configuration as { product_contract?: string };
    if (
      String(helper.product_contract).toLowerCase() !==
        network.coreAddress.toLowerCase() ||
      !isSecurityRelease(await network.read("get_config"))
    )
      throw new ApiError(
        409,
        "The evidence helper and product security versions must match.",
        "security_update_required",
      );
  }
}
