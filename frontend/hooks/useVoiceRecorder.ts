"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface VoiceRecorderState {
  isRecording: boolean;
  isAnalyzing: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
  analyserNode: AnalyserNode | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export function useVoiceRecorder(): VoiceRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    setAnalyserNode(null);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    durationRef.current = 0;
    setDuration(0);
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      // Set up Web Audio API for visualization
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Set up MediaRecorder
      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setIsRecording(false);
        cleanup();
      };

      recorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
        // Auto-stop at 60 seconds
        if (durationRef.current >= 60) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 1000);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const msg =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone access denied. Click the lock icon in your browser's address bar and allow microphone access, then try again."
          : name === "NotFoundError"
          ? "No microphone found. Please connect a microphone and try again."
          : err instanceof Error
          ? err.message
          : "Microphone access denied";
      setError(msg);
      setIsRecording(false);
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (isRecording) stopRecording();
    setDuration(0);
    setAudioBlob(null);
    setError(null);
    setIsAnalyzing(false);
    durationRef.current = 0;
  }, [isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    isAnalyzing,
    duration,
    audioBlob,
    error,
    analyserNode,
    startRecording,
    stopRecording,
    reset,
  };
}
