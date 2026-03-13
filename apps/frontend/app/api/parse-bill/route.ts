// app/api/parse-bill/route.ts
// Receives voice transcript → returns structured bill JSON via Claude

export async function POST(req: Request) {
  try {
    const { transcript, userAddress } = await req.json();

    if (!transcript) {
      return Response.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a smart bill-splitting agent for a crypto payments app on Celo.
Parse the user's voice input about splitting expenses and return ONLY valid JSON with no markdown.

The user's wallet address is: ${userAddress || "unknown"}

Extract and return this exact shape:
{
  "title": "short bill name (e.g. Dinner, Uber, Groceries)",
  "totalAmountDisplay": "human readable (e.g. $120.00)",
  "totalAmount": number in dollars (e.g. 120),
  "participants": [
    {
      "address": "0x... (use user's address if they say 'me' or 'I', else '0xPENDING' if unknown)",
      "shareDisplay": "$X.XX",
      "share": number in dollars
    }
  ],
  "confirmation": "natural spoken confirmation sentence (e.g. Got it! 0xABC owes $40 and you owe $40. Should I create this bill?)"
}

Rules:
- Shares must add up to totalAmount exactly
- If someone gets "extra", add it to their share and reduce others proportionally
- Equal split if no amounts specified
- Keep addresses short in confirmation (e.g. "0xABC...123")
- Return ONLY JSON, no explanation, no markdown fences`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        // FIX: correct header name is "x-api-key" (not "anthropic-api-key")
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // FIX: correct model string — "claude-sonnet-4-20250514" is wrong,
        // the current Sonnet 4 model string is "claude-sonnet-4-5"
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: transcript }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-bill] Anthropic API error:", err);
      return Response.json({ error: "Parsing failed" }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.content
      .map((c: { type: string; text?: string }) => c.text || "")
      .join("");

    // FIX: wrap JSON.parse in its own try/catch so a malformed Claude response
    // returns a clean error instead of a 500 with no context
    let parsed: unknown;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[parse-bill] Failed to parse Claude response:", raw);
      return Response.json(
        { error: "Could not understand the bill. Please try rephrasing." },
        { status: 400 }
      );
    }

    return Response.json(parsed);
  } catch (err: any) {
    console.error("[parse-bill] unexpected error:", err);
    return Response.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}