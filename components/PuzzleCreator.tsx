"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { supabase, hasSupabase } from "@/lib/supabase";
import { pickGrid } from "@/lib/puzzle";

const PIECE_OPTIONS = [12, 24, 48, 100, 200, 300];

export default function PuzzleCreator() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pieces, setPieces] = useState(48);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB 이하여야 합니다.");
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const start = async () => {
    if (!file) {
      setError("이미지를 먼저 선택해 주세요.");
      return;
    }
    if (!hasSupabase || !supabase) {
      setError(
        "Supabase 환경변수가 비어 있어요. README.md 의 설정 가이드를 확인해 주세요."
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const dims = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          const img = new window.Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("이미지를 열지 못했어요."));
          img.src = preview;
        }
      );

      const roomId = nanoid(8);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${roomId}.${ext}`;

      const up = await supabase.storage
        .from("puzzle-images")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage
        .from("puzzle-images")
        .getPublicUrl(path);

      const { cols, rows } = pickGrid(pieces, dims.w, dims.h);

      const ins = await supabase.from("rooms").insert({
        id: roomId,
        image_url: pub.publicUrl,
        image_w: dims.w,
        image_h: dims.h,
        cols,
        rows,
      });
      if (ins.error) throw ins.error;

      router.push(`/room/${roomId}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "퍼즐을 만들지 못했어요.";
      console.error(err);
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50 transition"
      >
        {preview ? (
          <img
            src={preview}
            alt="미리보기"
            className="max-h-44 mx-auto rounded"
          />
        ) : (
          <>
            <div className="text-3xl mb-1">📷</div>
            <p className="text-slate-500">이미지를 클릭해서 올려 주세요</p>
            <p className="text-xs text-slate-400 mt-1">JPG / PNG · 최대 5MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </div>

      <div>
        <label className="block text-sm text-slate-600 mb-2">조각 수</label>
        <div className="grid grid-cols-3 gap-2">
          {PIECE_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPieces(p)}
              className={`py-2 rounded-lg border font-medium text-sm transition ${
                pieces === p
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {p}조각
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm whitespace-pre-line">{error}</p>
      )}

      <button
        onClick={start}
        disabled={loading}
        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
      >
        {loading ? "퍼즐 준비 중..." : "퍼즐 시작하기"}
      </button>
    </div>
  );
}
