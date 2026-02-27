// app/api/auth/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("authorization")?.replace("Bearer ", "");
  
  console.log("🔍 Session ID from header:", sessionId);
  
  if (!sessionId) {
    console.log("❌ No session ID in header");
    return NextResponse.json({ 
      authenticated: false 
    }, { 
      status: 401 
    });
  }

  const session = getSession(sessionId);
  
  if (session) {
    console.log("✅ Valid session for FID:", session.fid);
    return NextResponse.json({ 
      authenticated: true, 
      fid: session.fid 
    });
  }
  
  console.log("❌ Invalid or expired session");
  return NextResponse.json({ 
    authenticated: false 
  }, { 
    status: 401 
  });
}