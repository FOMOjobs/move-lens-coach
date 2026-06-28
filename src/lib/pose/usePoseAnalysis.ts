/**
 * Hook usePoseAnalysis — ładuje MediaPipe Tasks Vision z CDN,
 * spina <video> z PoseLandmarker w trybie VIDEO i wywołuje callback
 * z bieżącymi landmarkami w pętli requestAnimationFrame.
 *
 * Cały kod analizy obrazu wykonuje się lokalnie. Klatki nie opuszczają
 * urządzenia.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pt } from "./geometry";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const VISION_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs";

export type PoseFrameCallback = (
  landmarks: Pt[] | null,
  timestampMs: number,
  ctx: { videoWidth: number; videoHeight: number },
) => void;

export interface UsePoseAnalysisOptions {
  onFrame: PoseFrameCallback;
  enabled: boolean;
  facingMode: "user" | "environment";
}

export function usePoseAnalysis({ onFrame, enabled, facingMode }: UsePoseAnalysisOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    let cancelled = false;

    async function start() {
      try {
        setStatus("loading");
        setError(null);

        // Dynamiczny import ESM z CDN
        const vision: any = await import(/* @vite-ignore */ VISION_MODULE_URL);
        if (cancelled) return;

        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;

        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) {
          landmarker.close?.();
          return;
        }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        setStatus("ready");

        const loop = () => {
          if (!videoRef.current || !landmarkerRef.current) return;
          const v = videoRef.current;
          const ts = performance.now();
          // MediaPipe wymaga ściśle rosnących timestampów
          const safeTs = ts <= lastTsRef.current ? lastTsRef.current + 1 : ts;
          lastTsRef.current = safeTs;
          try {
            const result = landmarkerRef.current.detectForVideo(v, safeTs);
            const lm = result?.landmarks?.[0] ?? null;
            onFrameRef.current(lm, safeTs, {
              videoWidth: v.videoWidth,
              videoHeight: v.videoHeight,
            });
          } catch (e) {
            // pojedynczy błąd klatki nie powinien wywalić pętli
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e: any) {
        console.error("Pose init failed", e);
        setError(e?.message ?? String(e));
        setStatus("error");
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close?.();
        } catch {}
        landmarkerRef.current = null;
      }
    };
  }, [enabled, facingMode, stop]);

  return { videoRef, status, error };
}
