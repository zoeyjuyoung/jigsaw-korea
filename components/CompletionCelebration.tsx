"use client";

import { useEffect, useMemo } from "react";

type Confetti = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
};

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function CompletionCelebration({
  onClose,
}: {
  onClose: () => void;
}) {
  const confetti = useMemo<Confetti[]>(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      size: 8 + Math.random() * 10,
      rotate: Math.random() * 360,
    }));
  }, []);

  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <style>{`
        @keyframes jigsaw-fall {
          0% {
            transform: translateY(-20vh) rotate(var(--r));
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) rotate(calc(var(--r) + 720deg));
            opacity: 0.8;
          }
        }
        @keyframes jigsaw-pop {
          0% { transform: scale(0.5); opacity: 0; }
          40% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {confetti.map((c) => (
        <div
          key={c.id}
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: 0,
            width: c.size,
            height: c.size,
            backgroundColor: c.color,
            borderRadius: 2,
            animation: `jigsaw-fall ${c.duration}s linear ${c.delay}s forwards`,
            // @ts-expect-error CSS 변수
            "--r": `${c.rotate}deg`,
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div
          className="bg-white rounded-2xl shadow-2xl px-8 py-7 text-center max-w-sm mx-4"
          style={{ animation: "jigsaw-pop 0.5s ease-out" }}
        >
          <div className="text-6xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">완성!</h2>
          <p className="text-slate-600 mb-5">
            함께 멋진 퍼즐을 맞추셨어요. 수고하셨습니다!
          </p>
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold transition"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
