import ReleaseWorkspace from "../components/ReleaseWorkspace";
import { currentRelease } from "../lib/releases";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ release?: string }>;
}) {
  const query = await searchParams;
  return <ReleaseWorkspace releaseId={query.release ?? currentRelease.id} />;
}
