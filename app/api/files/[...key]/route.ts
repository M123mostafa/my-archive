import { getObjectFromR2, isR2Configured } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!isR2Configured()) {
    return new NextResponse("Cloudflare R2 storage is not configured.", { status: 404 });
  }

  try {
    const resolvedParams = await params;
    const key = resolvedParams.key.join("/");

    if (!key) {
      return new NextResponse("File key is required", { status: 400 });
    }

    const r2Object = await getObjectFromR2(key);
    if (!r2Object.Body) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stream = r2Object.Body.transformToWebStream();
    const contentType = r2Object.ContentType || "application/octet-stream";
    const contentLength = r2Object.ContentLength?.toString();

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("GET /api/files error:", error);
    return new NextResponse("Failed to load file from storage.", { status: 500 });
  }
}
