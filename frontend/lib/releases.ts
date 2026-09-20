import currentCore from "./deployment.json" with { type: "json" };
import currentHelper from "./evidence-deployment.json" with { type: "json" };
import v4Core from "./deployment-v4.json" with { type: "json" };
import v4Helper from "./evidence-deployment-v4.json" with { type: "json" };
import retained from "./retained-releases.json" with { type: "json" };

export type Release = {
  id: string;
  core: typeof currentCore;
  helper: typeof currentHelper;
};
export function validateRelease(release: Release): Release {
  const { core, helper } = release;
  if (
    ![4, 5].includes(core.protocolVersion) ||
    release.id !== `v${core.protocolVersion}` ||
    helper.protocolVersion !== core.protocolVersion
  )
    throw new Error("Unsupported or mismatched release.");
  if (core.rpcUrl !== "https://studio.genlayer.com/api")
    throw new Error("Unapproved release RPC.");
  for (const manifest of [core, helper]) {
    if (
      manifest.network !== "studionet" ||
      manifest.chainId !== 61999 ||
      !/^0x[0-9a-fA-F]{40}$/.test(manifest.contractAddress) ||
      /^0x0{40}$/i.test(manifest.contractAddress) ||
      !/^0x[0-9a-fA-F]{64}$/.test(manifest.deploymentTransaction) ||
      !/^[a-f0-9]{64}$/.test(manifest.sourceSha256)
    )
      throw new Error("Incomplete release manifest.");
  }
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(core.ownerAddress) ||
    /^0x0{40}$/i.test(core.ownerAddress) ||
    core.contractAddress.toLowerCase() === helper.contractAddress.toLowerCase()
  )
    throw new Error("Invalid release addresses.");
  return release;
}
export const legacyRelease = validateRelease({
  id: "v4",
  core: v4Core,
  helper: v4Helper,
});
export const currentRelease = validateRelease({
  id: `v${currentCore.protocolVersion}`,
  core: currentCore,
  helper: currentHelper,
});
function releaseIdentity(release: Release) {
  return JSON.stringify([
    release.id,
    release.core.ownerAddress.toLowerCase(),
    release.core.rpcUrl,
    ...[release.core, release.helper].map((manifest) => [
      manifest.network,
      manifest.chainId,
      manifest.protocolVersion,
      manifest.contractAddress.toLowerCase(),
      manifest.deploymentTransaction.toLowerCase(),
      manifest.sourceSha256,
    ]),
  ]);
}
// Never rewrite v4's identity when activating a new default.
if (
  currentRelease.id === "v4" &&
  releaseIdentity(currentRelease) !== releaseIdentity(legacyRelease)
)
  throw new Error("The accepted v4 release must remain unchanged.");
export function buildReleaseRegistry(
  defaultRelease: Release,
  additional: Release[],
): readonly Release[] {
  validateRelease(defaultRelease);
  const all = [legacyRelease, ...additional.map(validateRelease)];
  if (new Set(all.map((release) => release.id)).size !== all.length)
    throw new Error("Duplicate retained release.");
  const addresses = all.flatMap((release) => [
    release.core.contractAddress.toLowerCase(),
    release.helper.contractAddress.toLowerCase(),
  ]);
  if (new Set(addresses).size !== addresses.length)
    throw new Error("Release addresses must be distinct.");
  const match = all.find((release) => release.id === defaultRelease.id);
  if (!match || releaseIdentity(match) !== releaseIdentity(defaultRelease))
    throw new Error(
      "Retain the verified release before making it the default.",
    );
  return [match, ...all.filter((release) => release.id !== match.id)];
}
export const releases = buildReleaseRegistry(currentRelease, retained);
export function releaseById(id: string): Release {
  const release = releases.find((item) => item.id === id);
  if (!release)
    throw new Error("This release is not available. No transaction was sent.");
  return release;
}
export function recordPath(id: string, releaseId = legacyRelease.id): string {
  releaseById(releaseId);
  return `/agreements/${encodeURIComponent(id)}?release=${encodeURIComponent(releaseId)}`;
}
