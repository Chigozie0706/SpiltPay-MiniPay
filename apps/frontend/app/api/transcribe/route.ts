// Receives audio blob from frontend, sends to ElevenLabs STT, returns transcript

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob) {
      return Response.json({ error: "No audio provided" }, { status: 400 });
    }

    // Forward to ElevenLabs STT
    const elFormData = new FormData();
    elFormData.append("file", audioBlob, "recording.webm");
    elFormData.append("model_id", "scribe_v2");
    elFormData.append("language_code", "eng");

    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: elFormData,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs STT error:", err);
      return Response.json({ error: "Transcription failed" }, { status: 500 });
    }

    const data = await response.json();
    return Response.json({ transcript: data.text });
  } catch (err) {
    console.error("Transcribe route error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}