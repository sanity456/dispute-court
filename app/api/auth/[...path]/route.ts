import type { NextRequest } from "next/server";
import { authRequest } from "@product/auth";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const handle = (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) => authRequest(request, context);
export const GET = handle;
export const POST = handle;
