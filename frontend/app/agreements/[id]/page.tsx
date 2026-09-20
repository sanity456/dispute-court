import type { Metadata } from "next";
import ReleaseWorkspace from "../../../components/ReleaseWorkspace";
import { getDb } from "../../../server/db";
import { createNetwork } from "../../../server/network";
import { product } from "../../../lib/product";
import { releaseById } from "../../../lib/releases";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ release?: string }>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const releaseId = (await searchParams).release ?? "v4";
  let title = product.name + " record",
    description =
      "Review the public terms, current status and next step on GenLayer Studionet.";
  if (id && id.length <= 80) {
    try {
      const release = releaseById(releaseId);
      const db = await getDb(release.id);
      const value = (await createNetwork(db, release).read(
        product.detailMethod,
        [id],
      )) as Record<string, unknown>;
      title = String(value.title ?? title) + " · " + product.name;
      description = String(
        value.description ?? value.summary ?? description,
      ).slice(0, 180);
    } catch {
      /* Unavailable is not the same as nonexistent; the workspace shows the actual error. */
    }
  }
  const url =
    product.origin +
    "/agreements/" +
    encodeURIComponent(id) +
    "?release=" +
    encodeURIComponent(releaseId);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: { title, description, url, type: "website", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}
export default async function RecordPage({ params, searchParams }: Props) {
  const { id } = await params;
  const releaseId = (await searchParams).release ?? "v4";
  return (
    <ReleaseWorkspace key={releaseId} releaseId={releaseId} initialId={id} />
  );
}
