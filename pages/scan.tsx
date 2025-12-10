// pages/scan.tsx
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type ScanMode = "qr" | "document";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<ScanMode>("qr");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // camera setup
  useEffect(() => {
    async function initCamera() {
      try {
        setErrorMsg(null);

        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setErrorMsg(
            "Camera not supported in this preview. Try on real mobile browser with HTTPS."
          );
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(
          "Camera access blocked. Browser settings me permission allow karo."
        );
      }
    }

    initCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, []);

  // QR scan loop
  useEffect(() => {
    if (mode !== "qr") return;

    let frameId: number;

    const scanFrame = () => {
      if (!isScanning) return;

      if (!videoRef.current || !canvasRef.current) {
        frameId = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        frameId = requestAnimationFrame(scanFrame);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        frameId = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, width, height);

      if (code && code.data) {
        setResult(code.data);
        setIsScanning(false);
        return;
      }

      frameId = requestAnimationFrame(scanFrame);
    };

    if (isScanning) {
      frameId = requestAnimationFrame(scanFrame);
    }

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isScanning, mode]);

  const handleCaptureDocument = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);

    const imageUrl = canvas.toDataURL("image/jpeg", 0.9);
    setResult(
      "Document captured. Image stored in memory. Future AI pipeline yahi se run hoga."
    );
    console.log("Captured document image url", imageUrl);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Heading */}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Scan center</h1>
          <p className="text-xs text-slate-400">
            UPI QR, normal QR, links ya documents capture karo. Future me yahi
            se Genstrok AI all analysis karega.
          </p>
        </header>

        {/* Camera card */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-xl overflow-hidden">
          <div className="relative w-full aspect-[3/4] bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            {/* focus frame overlay */}
            <div className="absolute inset-8 rounded-3xl border border-violet-400/40 pointer-events-none" />
          </div>

          {errorMsg && (
            <div className="px-4 py-2 text-[11px] text-rose-300 border-t border-slate-800">
              {errorMsg}
            </div>
          )}

          {!errorMsg && !cameraReady && (
            <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-800">
              Initializing camera. Thoda wait karo...
            </div>
          )}
        </section>

        {/* Mode selector */}
        <section className="flex items-center rounded-full bg-slate-900/80 border border-slate-800 p-1 text-xs">
          <button
            onClick={() => {
              setMode("qr");
              setResult(null);
            }}
            className={
              "flex-1 rounded-full py-1.5 text-center transition " +
              (mode === "qr"
                ? "bg-violet-500 text-white"
                : "text-slate-300")
            }
          >
            QR / UPI scan
          </button>
          <button
            onClick={() => {
              setMode("document");
              setResult(null);
              setIsScanning(false);
            }}
            className={
              "flex-1 rounded-full py-1.5 text-center transition " +
              (mode === "document"
                ? "bg-violet-500 text-white"
                : "text-slate-300")
            }
          >
            Document capture
          </button>
        </section>

        {/* Primary action button */}
        <section>
          {mode === "qr" ? (
            <button
              disabled={!!errorMsg || !cameraReady}
              onClick={() => {
                setResult(null);
                setIsScanning(true);
              }}
              className={
                "w-full rounded-full py-2.5 text-xs font-semibold tracking-wide " +
                (errorMsg || !cameraReady
                  ? "bg-slate-800 text-slate-500"
                  : "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-700/40")
              }
            >
              {isScanning ? "Scanning in progress..." : "Start QR scan"}
            </button>
          ) : (
            <button
              disabled={!!errorMsg || !cameraReady}
              onClick={handleCaptureDocument}
              className={
                "w-full rounded-full py-2.5 text-xs font-semibold tracking-wide " +
                (errorMsg || !cameraReady
                  ? "bg-slate-800 text-slate-500"
                  : "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-700/40")
              }
            >
              Capture document image
            </button>
          )}
        </section>

        {/* Result box */}
        {result && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="text-[11px] text-slate-400 mb-1">Scan result</div>
            <div className="text-xs text-slate-100 break-words">{result}</div>
          </section>
        )}
      </div>

      {/* hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}