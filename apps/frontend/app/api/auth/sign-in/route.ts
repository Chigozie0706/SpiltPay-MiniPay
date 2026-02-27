// app/api/auth/sign-in/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📦 Sign-in request body:", body);
    
    const { token, fid } = body;

    if (!token || !fid) {
      console.error("❌ Missing token or fid");
      return NextResponse.json(
        { error: "Missing token or fid" },
        { status: 400 }
      );
    }

    // Create a session and get session ID
    const sessionId = createSession(fid.toString());

    console.log("✅ Sign-in successful, created session:", sessionId);
    
    return NextResponse.json({ 
      success: true, 
      sessionId,
      fid,
      message: "Signed in successfully" 
    });
    
  } catch (error) {
    console.error("❌ Sign-in API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}