"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { Mic, Square, Loader2, CheckCircle, X, Volume2 } from "lucide-react";

interface ParsedBill {
  title: string;
  totalAmountDisplay: string;
  totalAmount: number;
  participants: { address: string; shareDisplay: string; share: number }[];
  confirmation: string;
}

interface VoiceSplitAgentProps {
  onBillParsed?: (bill: ParsedBill) => void;
}

type AgentState =
  | "idle"
  | "listening"
  | "processing"
  | "confirming"
  | "done"
  | "error";

// This header bypasses ngrok's browser interstitial page on free tunnels.
// It must be present on EVERY fetch — including FormData requests.
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" };

export function VoiceSplitAgent({ onBillParsed }: VoiceSplitAgentProps) {
  const { address: userAddress } = useAccount();

  const [state, setState] = useState<AgentState>("idle");
  const [parsedBill, setParsedBill] = useState<ParsedBill | null>(null);
  const [message, setMessage] = useState("Tap the mic and describe the bill.");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Use a ref for userAddress so the recording callback always sees the latest value
  const userAddressRef = useRef(userAddress);
  userAddressRef.current = userAddress;

  // ── Visualizer ──────────────────────────────────────────────────────────────
  const startVisualizer = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
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
    audioContextRef.current?.close().catch(() => {});
    const canvas = waveCanvasRef.current;
    if (canvas)
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── TTS ─────────────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    try {
      setIsSpeaking(true);
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...NGROK_HEADER,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS request failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url); // clean up blob URL after playback
      };
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  // ── Process audio after stop ─────────────────────────────────────────────────
  const handleRecordingStop = useCallback(
    async (chunks: Blob[]) => {
      try {
        setState("processing");
        setMessage("Transcribing your audio...");

        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        // FIX: FormData fetches also need the ngrok header — this was the
        // cause of the 401. You cannot set Content-Type manually on FormData
        // (the browser sets it with the boundary automatically), but you CAN
        // add other headers like the ngrok bypass header here.
        const sttRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { ...NGROK_HEADER }, // ← this was missing, causing the 401
          body: formData,
        });

        const sttData = await sttRes.json();
        if (!sttRes.ok || !sttData.transcript) {
          throw new Error(sttData.error || "Could not transcribe audio.");
        }

        setMessage(`Heard: "${sttData.transcript}". Thinking...`);

        const parseRes = await fetch("/api/parse-bill", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...NGROK_HEADER,
          },
          body: JSON.stringify({
            transcript: sttData.transcript,
            userAddress: userAddressRef.current,
          }),
        });

        const bill: ParsedBill = await parseRes.json();
        if (!parseRes.ok || !bill.title) {
          throw new Error(
            typeof bill === "object" && "error" in bill
              ? (bill as any).error
              : "Could not understand the bill.",
          );
        }

        setParsedBill(bill);
        setState("confirming");
        setMessage(bill.confirmation);
        await speakText(bill.confirmation);
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
        setState("error");
      }
    },
    [speakText],
  );

  // ── Start recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setError("");
      setState("listening");
      setMessage("Listening... tap Stop when done.");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => handleRecordingStop([...chunksRef.current]);

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startVisualizer(stream);
    } catch (err: any) {
      setError(
        err.name === "NotAllowedError"
          ? "Mic access denied. Please allow microphone permissions."
          : "Could not start recording: " + err.message,
      );
      setState("error");
    }
  };

  // ── Stop recording ───────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopVisualizer();
  }, [stopVisualizer]);

  const handleMicClick = () => {
    if (state === "listening") stopRecording();
    else if (state === "idle" || state === "done" || state === "error")
      startRecording();
  };

  const handleConfirm = () => {
    if (parsedBill && onBillParsed) onBillParsed(parsedBill);
    setState("done");
    setMessage("Bill details filled in below! Review and submit.");
  };

  const handleReset = () => {
    setState("idle");
    setParsedBill(null);
    setMessage("Tap the mic and describe the bill.");
    setError("");
  };

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
  const isDisabled = state === "processing" || state === "confirming";

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      {/* TOP BAR */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-900 font-semibold flex items-center gap-2 text-sm">
          <span>🎙️</span> Voice Input
        </h2>
        {state === "listening" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 bg-red-500 text-white font-bold px-4 py-2 rounded-full text-sm shadow-lg active:scale-95 transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-white text-white" />
            Stop
          </button>
        )}
      </div>

      {/* MIC BUTTON ROW */}
      <div className="flex items-center gap-4 mb-3">
        <div
          className="relative flex-shrink-0"
          style={{ width: 56, height: 56 }}
        >
          {state === "listening" &&
            [1, 2].map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-emerald-400 animate-ping pointer-events-none"
                style={{
                  opacity: 0.15,
                  animationDuration: `${1 + i * 0.4}s`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          <button
            onClick={handleMicClick}
            disabled={isDisabled}
            className="relative z-10 w-full h-full rounded-full flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40"
            style={{
              border: `2px solid ${color}`,
              background: `${color}15`,
              boxShadow: `0 0 12px ${color}30`,
            }}
          >
            {state === "processing" ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
            ) : state === "listening" ? (
              <Square className="w-5 h-5 fill-red-500 text-red-500" />
            ) : (
              <Mic className="w-5 h-5" style={{ color }} />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold self-start"
            style={{
              background: `${color}15`,
              color,
              border: `1px solid ${color}30`,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            {stateLabel[state]}
            {isSpeaking && <Volume2 className="w-3 h-3 animate-pulse" />}
          </div>
          <canvas
            ref={waveCanvasRef}
            width={180}
            height={28}
            className="rounded transition-opacity duration-300"
            style={{ opacity: state === "listening" ? 1 : 0 }}
          />
        </div>
      </div>

      {/* MESSAGE */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 border border-gray-200 leading-relaxed mb-2">
        {message}
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2 mb-2">
          <span className="text-red-600 text-sm flex-1">{error}</span>
          <button
            onClick={handleReset}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PARSED BILL CONFIRM */}
      {parsedBill && state === "confirming" && (
        <div className="border border-amber-200 rounded-xl overflow-hidden mb-2">
          <div className="bg-amber-50 px-3 py-2 flex justify-between items-center border-b border-amber-200">
            <span className="font-semibold text-amber-900 text-sm">
              {parsedBill.title}
            </span>
            <span className="font-bold text-amber-700 text-sm">
              {parsedBill.totalAmountDisplay}
            </span>
          </div>
          {parsedBill.participants.map((p, i) => (
            <div
              key={i}
              className="px-3 py-2 flex justify-between items-center text-sm border-b border-gray-100 last:border-0"
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
          <div className="px-3 py-2 flex gap-2 bg-gray-50">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm"
            >
              <CheckCircle className="w-4 h-4" /> Use This
            </button>
            <button
              onClick={handleReset}
              className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-lg text-sm hover:bg-gray-100"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* HINTS */}
      {(state === "idle" || state === "error") && (
        <div className="flex flex-wrap gap-1.5 justify-center mt-1">
          {[
            "Dinner $90, split 3 ways",
            "Uber $24 for 2 addresses",
            "Extra $20 for one person",
          ].map((hint) => (
            <span
              key={hint}
              className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200"
            >
              "{hint}"
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
