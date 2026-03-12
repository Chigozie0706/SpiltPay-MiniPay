"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { Mic, Square, Loader2, CheckCircle, X, Volume2 } from "lucide-react";

interface ParsedBill {
  title: string;
  totalAmountDisplay: string;
  totalAmount: number;
  participants: {
    address: string;
    shareDisplay: string;
    share: number;
  }[];
  confirmation: string;
}

interface VoiceSplitAgentProps {
  // Called when user confirms — pre-fills the CreateBill form
  onBillParsed?: (bill: ParsedBill) => void;
}

type AgentState =
  | "idle"
  | "listening"
  | "processing"
  | "confirming"
  | "done"
  | "error";

export function VoiceSplitAgent({ onBillParsed }: VoiceSplitAgentProps) {
  const { address: userAddress } = useAccount();

  const [state, setState] = useState<AgentState>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsedBill, setParsedBill] = useState<ParsedBill | null>(null);
  const [message, setMessage] = useState("Tap the mic and describe the bill.");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Visualizer ─────────────────────────────────────────────────────────────
  const startVisualizer = useCallback(async (stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    analyserRef.current = analyser;

    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d")!;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / data.length;
      data.forEach((v, i) => {
        const h = (v / 255) * canvas.height * 0.85;
        const grad = ctx2d.createLinearGradient(
          0,
          canvas.height,
          0,
          canvas.height - h,
        );
        grad.addColorStop(0, "#10b981");
        grad.addColorStop(1, "#34d399");
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(i * barW + 1, canvas.height - h, barW - 2, h);
      });
    };
    draw();
  }, []);

  const stopVisualizer = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    const canvas = waveCanvasRef.current;
    if (canvas)
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStop;

      mediaRecorderRef.current = recorder;
      recorder.start();

      setState("listening");
      setMessage("Listening... tap stop when done.");
      startVisualizer(stream);
    } catch (err) {
      setError("Microphone access denied. Please allow mic access.");
      setState("error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopVisualizer();
    setState("processing");
    setMessage("Transcribing your audio...");
  };

  // ── Process audio → transcript → parse → speak ─────────────────────────────
  const handleRecordingStop = async () => {
    try {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

      // 1. Speech → Text via ElevenLabs
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const sttData = await sttRes.json();

      if (!sttRes.ok || !sttData.transcript) {
        throw new Error("Could not transcribe audio");
      }

      setTranscript(sttData.transcript);
      setMessage("Understanding your request...");

      // 2. Transcript → structured bill via Claude
      const parseRes = await fetch("/api/parse-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: sttData.transcript,
          userAddress,
        }),
      });
      const bill: ParsedBill = await parseRes.json();

      if (!parseRes.ok || !bill.title) {
        throw new Error("Could not parse the bill");
      }

      setParsedBill(bill);
      setState("confirming");
      setMessage(bill.confirmation);

      // 3. Speak the confirmation via ElevenLabs TTS
      await speakText(bill.confirmation);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Try again.");
      setState("error");
    }
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setIsSpeaking(false);
      await audio.play();
    } catch {
      setIsSpeaking(false); // silent fail — text still shown
    }
  };

  // ── Confirm → pre-fill CreateBill ─────────────────────────────────────────
  const handleConfirm = () => {
    if (parsedBill && onBillParsed) {
      onBillParsed(parsedBill);
    }
    setState("done");
    setMessage("Bill details filled in below!");
  };

  const handleReset = () => {
    setState("idle");
    setParsedBill(null);
    setTranscript("");
    setMessage("Tap the mic and describe the bill.");
    setError("");
  };

  // ── Colors ─────────────────────────────────────────────────────────────────
  const stateColor: Record<AgentState, string> = {
    idle: "#6b7280",
    listening: "#10b981",
    processing: "#3b82f6",
    confirming: "#f59e0b",
    done: "#10b981",
    error: "#ef4444",
  };
  const stateLabel: Record<AgentState, string> = {
    idle: "Ready",
    listening: "Listening",
    processing: "Processing",
    confirming: "Confirm?",
    done: "Done",
    error: "Error",
  };

  const color = stateColor[state];
  const isActive = state === "listening" || state === "processing";

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
      <h2 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
        <span className="text-emerald-600">🎙️</span>
        Voice Input
      </h2>

      {/* Mic button */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          {/* Pulse rings when listening */}
          {state === "listening" && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-emerald-400 animate-ping"
                  style={{
                    width: 72 + i * 20,
                    height: 72 + i * 20,
                    opacity: 0.15 / i,
                    animationDuration: `${0.8 + i * 0.3}s`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </>
          )}

          <button
            onClick={state === "listening" ? stopRecording : startRecording}
            disabled={state === "processing" || state === "confirming"}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              border: `2px solid ${color}`,
              background: `${color}18`,
              boxShadow: `0 0 20px ${color}33`,
            }}
          >
            {state === "processing" ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color }} />
            ) : state === "listening" ? (
              <Square className="w-6 h-6 fill-red-500 text-red-500" />
            ) : (
              <Mic className="w-6 h-6" style={{ color }} />
            )}
          </button>
        </div>

        {/* State badge */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
          />
          {stateLabel[state]}
          {isSpeaking && <Volume2 className="w-3 h-3 ml-1 animate-pulse" />}
        </div>

        {/* Waveform */}
        <canvas
          ref={waveCanvasRef}
          width={280}
          height={40}
          className="rounded-lg transition-opacity"
          style={{ opacity: state === "listening" ? 1 : 0 }}
        />

        {/* Transcript */}
        {transcript && (
          <div className="w-full bg-gray-50 rounded-lg p-3 text-sm text-gray-500 italic border border-gray-200">
            "{transcript}"
          </div>
        )}

        {/* Agent message */}
        <div className="w-full bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200 leading-relaxed">
          {message}
        </div>

        {/* Error */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <span className="text-red-600 text-sm">{error}</span>
            <button
              onClick={handleReset}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Parsed bill preview + confirm */}
        {parsedBill && state === "confirming" && (
          <div className="w-full border border-amber-200 rounded-xl overflow-hidden">
            <div className="bg-amber-50 px-4 py-3 flex justify-between items-center border-b border-amber-200">
              <span className="font-semibold text-amber-900">
                {parsedBill.title}
              </span>
              <span className="font-bold text-amber-700">
                {parsedBill.totalAmountDisplay}
              </span>
            </div>
            {parsedBill.participants.map((p, i) => (
              <div
                key={i}
                className="px-4 py-2.5 flex justify-between items-center text-sm border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-500 font-mono text-xs">
                  {p.address === userAddress
                    ? "You"
                    : p.address === "0xPENDING"
                    ? "⚠️ Address needed"
                    : `${p.address.slice(0, 6)}...${p.address.slice(-4)}`}
                </span>
                <span className="font-semibold text-gray-800">
                  {p.shareDisplay}
                </span>
              </div>
            ))}
            <div className="px-4 py-3 flex gap-2 bg-gray-50">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Use This
              </button>
              <button
                onClick={handleReset}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-lg hover:bg-gray-100 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Hint examples */}
        {(state === "idle" || state === "error") && (
          <div className="w-full">
            <p className="text-xs text-gray-400 mb-2 text-center">
              Try saying:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Dinner was $90, split 3 ways",
                "Uber for 0xABC and 0xDEF, $24 total",
                "Bob gets extra $20 on the $120 bill",
              ].map((hint) => (
                <span
                  key={hint}
                  className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full border border-gray-200"
                >
                  "{hint}"
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
