import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import WalletAuthScreen from "../../../components/WalletAuthScreen";
import { product } from "../../../lib/product";
export const metadata: Metadata = {
  title: "Wallet sign-in · " + product.name,
  robots: { index: false, follow: false },
};
export default async function AccountPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (["sign-up", "forgot-password", "reset-password"].includes(view))
    redirect("/auth/sign-in");
  if (view !== "sign-in" && view !== "sign-out") notFound();
  return <WalletAuthScreen signOut={view === "sign-out"} />;
}
