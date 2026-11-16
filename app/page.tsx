"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PuzzleCreator from "@/components/PuzzleCreator";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    router.push(`/room/${encodeURIComponent(code)}`);
  };

  return (
    <div className="flex-1 bg-gradient-to-b from-sky-50 via-indigo-50 to-indigo-100">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <header className="text-center mb-10 md:mb-14">
          <div className="inline-block text-5xl mb-3">🧩</div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-3 tracking-tight">
            한글 직소 퍼즐
          </h1>
          <p className="text-slate-600 text-base md:text-lg">
            친구들과 같은 방에서 <b>실시간으로 함께</b> 맞춰 보세요.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-semibold mb-5 text-slate-800 flex items-center gap-2">
              <span>✨</span> 새 퍼즐 만들기
            </h2>
            <PuzzleCreator />
          </section>

          <section className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-semibold mb-5 text-slate-800 flex items-center gap-2">
              <span>🚪</span> 방 코드로 참여
            </h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block">
                <span className="block text-sm text-slate-600 mb-1">
                  방 코드 또는 전체 링크
                </span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="예: 7xA3kP9q"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition"
              >
                방에 입장하기
              </button>
              <p className="text-xs text-slate-500 leading-relaxed">
                친구가 보내준 링크를 받았다면 그냥 그 링크로 접속하셔도 됩니다.
                닉네임만 정하면 바로 함께 퍼즐을 맞출 수 있어요.
              </p>
            </form>
          </section>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-4 text-sm text-slate-600">
          <Feature emoji="🖼️" title="내 사진으로">
            원하는 사진을 올려서 나만의 퍼즐을 만드세요.
          </Feature>
          <Feature emoji="👥" title="같이 맞추기">
            같은 방에 들어오면 한 명이 옮긴 조각이 모두에게 보여요.
          </Feature>
          <Feature emoji="🎉" title="완성의 기쁨">
            마지막 조각을 맞추면 축하 애니메이션이 나와요.
          </Feature>
        </div>
      </div>
    </div>
  );
}

function Feature({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl p-4">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="font-semibold text-slate-800 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}
