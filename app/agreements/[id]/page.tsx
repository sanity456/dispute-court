import type { Metadata } from "next";
import ProductHome from "../../../components/ProductHome";
import { getDb } from "../../../server/db";
import { createNetwork } from "../../../server/network";
import { product } from "../../../lib/product";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let title = product.name + " record",
    description =
      "Review the public terms, current status and next step on GenLayer Studionet.";
  if (id && id.length <= 80) {
    try {
      const db = await getDb();
      const value = (await createNetwork(db).read(product.detailMethod, [
        id,
      ])) as Record<string, unknown>;
      title = String(value.title ?? title) + " · " + product.name;
      description = String(
        value.description ?? value.summary ?? description,
      ).slice(0, 180);
    } catch {
      /* Unavailable is not the same as nonexistent; the workspace shows the actual error. */
    }
  }
  const url =
    product.origin + "/" + product.recordPath + "/" + encodeURIComponent(id);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: { title, description, url, type: "website", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}
export default async function RecordPage({ params }: Props) {
  const { id } = await params;
  return <ProductHome key={id} initialId={id} />;
}
