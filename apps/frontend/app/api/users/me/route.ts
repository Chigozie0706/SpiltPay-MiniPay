// app/api/users/me/route.ts
import { fetchUser } from "@/lib/neynar";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const user = await fetchUser(session.fid);
    return NextResponse.json(user);
  } catch (error: any) {
    console.error("Error in /api/users/me:", error);

    if (error.message === "RATE_LIMIT_EXCEEDED") {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a minute." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}