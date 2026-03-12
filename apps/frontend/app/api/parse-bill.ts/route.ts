// app/api/parse-bill/route.ts
// Receives voice transcript, returns structured bill JSON via Claude API

export async function POST(req: Request) {
  try {
    const { transcript, userAddress } = await req.json();

    if (!transcript) {
      return Response.json({ error: "No transcript provided" }, { status: 400 });
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
- Shares must add up to totalAmount
- If someone gets "extra", add it to their share and reduce others proportionally
- Equal split if no amounts specified
- Keep addresses short in confirmation (e.g. "0xABC...123")
- Return ONLY JSON, no explanation, no markdown fences`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: transcript }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return Response.json({ error: "Parsing failed" }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.content.map((c: any) => c.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json(parsed);
  } catch (err) {
    console.error("Parse bill route error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}