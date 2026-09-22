import { useEffect, useRef, useState, type RefObject } from "react";

export interface MouseSample {
  x: number;
  y: number;
  t: number;
}

export interface UseMouseTelemetryOptions {
  hesitationThresholdMs?: number;
  idleVelocityCutoff?: number;
  smoothing?: number;
  sampleHistory?: number;
  target?: RefObject<HTMLElement> | null;
}

export interface UseMouseTelemetryResult {
  position: { x: number; y: number };
  velocity: number;
  isHesitating: boolean;
  hesitationDuration: number;
  samples: MouseSample[];
}

export function useMouseTelemetry({
  hesitationThresholdMs = 600,
  idleVelocityCutoff = 5,
  smoothing = 0.3,
  sampleHistory = 30,
  target = null,
}: UseMouseTelemetryOptions = {}): UseMouseTelemetryResult {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState(0);
  const [isHesitating, setIsHesitating] = useState(false);
  const [hesitationDuration, setHesitationDuration] = useState(0);
  const [samples, setSamples] = useState<MouseSample[]>([]);

  const lastPoint = useRef<MouseSample | null>(null);
  const smoothedVelocity = useRef(0);
  const idleSince = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const hesitationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const node: HTMLElement | Window = target?.current ?? window;

    const handleMove = (e: MouseEvent) => {
      const now = performance.now();
      const point: MouseSample = { x: e.clientX, y: e.clientY, t: now };

      if (lastPoint.current) {
        const dt = Math.max(now - lastPoint.current.t, 1);
        const dx = point.x - lastPoint.current.x;
        const dy = point.y - lastPoint.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const instantVelocity = (distance / dt) * 1000;

        smoothedVelocity.current =
          smoothing * instantVelocity + (1 - smoothing) * smoothedVelocity.current;

        const currentVelocity = smoothedVelocity.current;

        if (currentVelocity < idleVelocityCutoff) {
          if (idleSince.current === null) idleSince.current = now;
        } else {
          idleSince.current = null;
          setIsHesitating(false);
          setHesitationDuration(0);
        }

        setVelocity(currentVelocity);
      }

      setPosition({ x: point.x, y: point.y });
      setSamples((prev) => {
        const next = [...prev, point];
        return next.length > sampleHistory ? next.slice(next.length - sampleHistory) : next;
      });

      lastPoint.current = point;
    };

    node.addEventListener("mousemove", handleMove as EventListener, { passive: true });

    hesitationTimer.current = setInterval(() => {
      if (idleSince.current !== null) {
        const idleFor = performance.now() - idleSince.current;
        setHesitationDuration(idleFor);
        setIsHesitating(idleFor >= hesitationThresholdMs);
      }
    }, 100);

    return () => {
      node.removeEventListener("mousemove", handleMove as EventListener);
      if (hesitationTimer.current) clearInterval(hesitationTimer.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [hesitationThresholdMs, idleVelocityCutoff, smoothing, sampleHistory, target]);

  return { position, velocity, isHesitating, hesitationDuration, samples };
}