import v4 from "./contract-schema.json" with { type: "json" };
import v5 from "./contract-schema-v5.json" with { type: "json" };

// A checked-in deployment manifest, never a browser-supplied version, selects
// the callable surface. Adding the candidate cannot enable v5 calls on v4.
export function contractSurface(version: number) {
  if (version === 4) return v4.methods;
  if (version === 5) return v5.methods;
  throw new Error("Unsupported Dispute Court deployment version.");
}
