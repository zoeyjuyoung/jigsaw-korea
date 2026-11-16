"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase, hasSupabase } from "@/lib/supabase";
import type { RoomMeta } from "@/lib/types";

const PuzzleBoard = dynamic(() => import("@/components/PuzzleBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-slate-500">
      퍼즐을 불러오는 중...
    </div>
  ),
});

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function PuzzleRoomClient({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [error, setError] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);
  const [myColor, setMyColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      setError(
        "Supabase 환경변수가 비어 있어요. README.md 의 설정 가이드를 확인해 주세요."
      );
      return;
    }
    let cancelled = false;
    supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setError(
            `방을 찾지 못했어요 (${roomId}). 링크를 다시 확인해 주세요.`
          );
          return;
        }
        const r = data as Omit<RoomMeta, "piece_w" | "piece_h">;
        setRoom({
          ...r,
          piece_w: r.image_w / r.cols,
          piece_h: r.image_h / r.rows,
        });
      });

    const saved = localStorage.getItem("jigsaw:nickname") || "";
    if (saved) setNickname(saved);
    const savedColor = localStorage.getItem("jigsaw:color");
    setMyColor(
      savedColor && COLORS.includes(savedColor)
        ? savedColor
        : COLORS[Math.floor(Math.random() * COLORS.length)]
    );

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const join = () => {
    const name = nickname.trim();
    if (!name) return;
    localStorage.setItem("jigsaw:nickname", name);
    localStorage.setItem("jigsaw:color", myColor);
    setJoined(true);
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">문제가 생겼어요</p>
          <p className="text-slate-600 text-sm whitespace-pre-line">{error}</p>
          <a
            href="/"
            className="mt-6 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            홈으로
          </a>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        방 정보를 불러오는 중...
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <h2 className="text-xl font-semibold mb-1 text-slate-800">
            퍼즐 방에 입장
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            방 코드: <b>{roomId}</b>
          </p>
          <label className="block text-sm text-slate-600 mb-1">닉네임</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="퍼즐러"
            maxLength={16}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <label className="block text-sm text-slate-600 mb-2">내 색상</label>
          <div className="flex gap-2 mb-6 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setMyColor(c)}
                className={`w-9 h-9 rounded-full transition ${
                  myColor === c ? "ring-2 ring-offset-2 ring-slate-800" : ""
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <button
            onClick={join}
            disabled={!nickname.trim()}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <PuzzleBoard
      roomId={roomId}
      room={room}
      nickname={nickname.trim()}
      color={myColor}
    />
  );
}
