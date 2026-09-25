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
  const lastMoveTime = useRef<number>(performance.now());
  const hesitationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const node: HTMLElement | Window = target?.current ?? window;

    const handleMove = (e: MouseEvent) => {
      const now = performance.now();
      const point: MouseSample = { x: e.clientX, y: e.clientY, t: now };

      lastMoveTime.current = now;

      if (lastPoint.current) {
        const dt = Math.max(now - lastPoint.current.t, 1);
        const dx = point.x - lastPoint.current.x;
        const dy = point.y - lastPoint.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const instantVelocity = (distance / dt) * 1000;

        smoothedVelocity.current =
          smoothing * instantVelocity + (1 - smoothing) * smoothedVelocity.current;

        setVelocity(smoothedVelocity.current);
      }

      setIsHesitating(false);
      setHesitationDuration(0);

      setPosition({ x: point.x, y: point.y });
      setSamples((prev) => {
        const next = [...prev, point];
        return next.length > sampleHistory ? next.slice(next.length - sampleHistory) : next;
      });

      lastPoint.current = point;
    };

    node.addEventListener("mousemove", handleMove as EventListener, { passive: true });

    // Poll independently of mousemove — this is what actually detects
    // "no movement happened for a while", which mousemove alone can't.
    hesitationTimer.current = setInterval(() => {
      const idleFor = performance.now() - lastMoveTime.current;

      if (idleFor >= hesitationThresholdMs) {
        setIsHesitating(true);
        setHesitationDuration(idleFor);
        setVelocity(0);
        smoothedVelocity.current = 0;
      }
    }, 100);

    return () => {
      node.removeEventListener("mousemove", handleMove as EventListener);
      if (hesitationTimer.current) clearInterval(hesitationTimer.current);
    };
  }, [hesitationThresholdMs, idleVelocityCutoff, smoothing, sampleHistory, target]);

  return { position, velocity, isHesitating, hesitationDuration, samples };
}