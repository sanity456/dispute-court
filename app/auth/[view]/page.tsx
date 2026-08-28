import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthScreen, { type AuthView } from "../../../components/AuthScreen";
import { product } from "../../../lib/product";
export const metadata: Metadata = {
  title: "Your account · " + product.name,
  robots: { index: false, follow: false },
};
const views: AuthView[] = [
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "sign-out",
];
export default async function AccountPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view as AuthView)) notFound();
  return <AuthScreen view={view as AuthView} />;
}
