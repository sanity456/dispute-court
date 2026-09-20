"use client";
import { useEffect, useState } from "react";
import { initializeClientRelease } from "../lib/client-release";
import { releaseById } from "../lib/releases";
import ProductHome from "./ProductHome";

export default function ReleaseWorkspace({
  releaseId,
  initialId = "",
}: {
  releaseId: string;
  initialId?: string;
}) {
  const [openedId, setOpenedId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        releaseById(releaseId);
        initializeClientRelease(releaseId);
        setOpenedId(releaseId);
      } catch {
        setError(
          "This release cannot be opened here. Reload the page or open the current app.",
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [releaseId]);
  if (error)
    return (
      <main className="p-8" role="alert">
        {error}{" "}
        <button onClick={() => window.location.assign("/")}>
          Open current app
        </button>
      </main>
    );
  if (openedId !== releaseId)
    return (
      <main className="p-8" role="status">
        Opening Dispute Court…
      </main>
    );
  return <ProductHome key={initialId} initialId={initialId} />;
}
