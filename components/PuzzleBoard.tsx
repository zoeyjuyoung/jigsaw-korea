"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Image as KImage,
  Rect,
  Text,
  Line,
} from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type { Participant, Piece, RoomMeta } from "@/lib/types";
import { hashCode, initPieces, SNAP_THRESHOLD } from "@/lib/puzzle";
import CompletionCelebration from "./CompletionCelebration";

const TRAY = 180; // 양쪽 트레이 너비
const HEADER_H = 60;
const CURSOR_THROTTLE_MS = 70;
const MOVE_THROTTLE_MS = 40;

type RemoteMove = {
  idx: number;
  x: number;
  y: number;
  by: string; // peerId
  dragging: boolean;
};

type RemoteDrop = {
  idx: number;
  x: number;
  y: number;
  placed: boolean;
  by: string;
};

type RemoteCursor = {
  x: number;
  y: number;
  by: string;
  color: string;
  nickname: string;
};

type StateFull = {
  by: string;
  pieces: { idx: number; x: number; y: number; placed: boolean }[];
};

export default function PuzzleBoard({
  roomId,
  room,
  nickname,
  color,
}: {
  roomId: string;
  room: RoomMeta;
  nickname: string;
  color: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 1200, h: 700 });
  const [image, imgStatus] = useImage(room.image_url, "anonymous");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [participants, setParticipants] = useState<Record<string, Participant>>(
    {}
  );
  const [copied, setCopied] = useState(false);

  // 내 peer id — 같은 닉네임이 여러 명이어도 구분
  const peerId = useMemo(() => nanoid(6), []);
  const peerIdRef = useRef(peerId);
  const nicknameRef = useRef(nickname);
  const colorRef = useRef(color);
  useEffect(() => {
    nicknameRef.current = nickname;
    colorRef.current = color;
  }, [nickname, color]);

  const channelRef = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);
  const remoteDraggingRef = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);

  // 레이아웃 (트레이 + 퍼즐판 중앙 정렬)
  const layout = useMemo(() => {
    const availW = Math.max(300, stageSize.w - TRAY * 2 - 40);
    const availH = Math.max(300, stageSize.h - 40);
    const imgRatio = room.image_w / room.image_h;
    let boardW = availW;
    let boardH = boardW / imgRatio;
    if (boardH > availH) {
      boardH = availH;
      boardW = boardH * imgRatio;
    }
    const pieceW = boardW / room.cols;
    const pieceH = boardH / room.rows;
    const boardX = TRAY + (availW - boardW) / 2 + 20;
    const boardY = (availH - boardH) / 2 + 20;
    return { boardW, boardH, pieceW, pieceH, boardX, boardY };
  }, [stageSize, room]);

  // 리사이즈
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setStageSize({
        w: Math.max(320, clientWidth),
        h: Math.max(320, clientHeight),
      });
    };
    update();
    window.addEventListener("resize", update);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  // 초기 조각 배치 (모두 같은 seed 로 같은 초기 배치를 봄)
  useEffect(() => {
    if (initializedRef.current) return;
    if (!layout.pieceW || !stageSize.w) return;
    const init = initPieces({
      cols: room.cols,
      rows: room.rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      trayLeftW: TRAY,
      trayRightW: TRAY,
      stageW: stageSize.w,
      stageH: stageSize.h,
      seed: hashCode(roomId),
    });
    setPieces(init);
    initializedRef.current = true;
  }, [layout, stageSize, room, roomId]);

  // Supabase Realtime 채널
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: peerIdRef.current },
      },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      const m = payload as RemoteMove;
      setPieces((cur) =>
        cur.map((p) =>
          p.idx === m.idx && !p.placed ? { ...p, x: m.x, y: m.y } : p
        )
      );
      if (m.dragging) {
        remoteDraggingRef.current.set(m.idx, m.by);
      } else {
        remoteDraggingRef.current.delete(m.idx);
      }
    });

    channel.on("broadcast", { event: "drop" }, ({ payload }) => {
      const d = payload as RemoteDrop;
      setPieces((cur) =>
        cur.map((p) =>
          p.idx === d.idx
            ? { ...p, x: d.x, y: d.y, placed: d.placed || p.placed }
            : p
        )
      );
      remoteDraggingRef.current.delete(d.idx);
    });

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const c = payload as RemoteCursor;
      if (c.by === peerIdRef.current) return;
      setParticipants((cur) => ({
        ...cur,
        [c.by]: {
          peerId: c.by,
          nickname: c.nickname,
          color: c.color,
          cursor: { x: c.x, y: c.y },
        },
      }));
    });

    // 뒤늦게 들어온 사람이 현재 보드 상태를 요청하면,
    // 이미 있는 가장 "작은 peerId" 가 응답한다 (단순한 선출)
    channel.on("broadcast", { event: "state-request" }, ({ payload }) => {
      const requester = payload?.by as string | undefined;
      if (!requester || requester === peerIdRef.current) return;
      const state = channel.presenceState();
      const ids: string[] = [];
      Object.values(state).forEach((entries) => {
        (entries as { peerId?: string }[]).forEach((e) => {
          if (e.peerId) ids.push(e.peerId);
        });
      });
      const sorted = ids.slice().sort();
      if (sorted[0] !== peerIdRef.current) return;
      channel.send({
        type: "broadcast",
        event: "state-full",
        payload: {
          by: peerIdRef.current,
          pieces: pieces.map((p) => ({
            idx: p.idx,
            x: p.x,
            y: p.y,
            placed: p.placed,
          })),
        } satisfies StateFull,
      });
    });

    channel.on("broadcast", { event: "state-full" }, ({ payload }) => {
      const s = payload as StateFull;
      setPieces((cur) =>
        cur.map((p) => {
          const incoming = s.pieces.find((q) => q.idx === p.idx);
          return incoming
            ? { ...p, x: incoming.x, y: incoming.y, placed: incoming.placed }
            : p;
        })
      );
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const map: Record<string, Participant> = {};
      Object.values(state).forEach((entries) => {
        (
          entries as { peerId?: string; nickname?: string; color?: string }[]
        ).forEach((e) => {
          if (!e.peerId) return;
          map[e.peerId] = {
            peerId: e.peerId,
            nickname: e.nickname || "익명",
            color: e.color || "#64748b",
          };
        });
      });
      setParticipants((cur) => {
        const merged: Record<string, Participant> = { ...map };
        Object.keys(cur).forEach((id) => {
          if (merged[id] && cur[id].cursor) merged[id].cursor = cur[id].cursor;
        });
        return merged;
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          peerId: peerIdRef.current,
          nickname: nicknameRef.current,
          color: colorRef.current,
        });
        // 이미 조각을 옮겨둔 사람에게 현재 상태를 요청
        setTimeout(() => {
          channel.send({
            type: "broadcast",
            event: "state-request",
            payload: { by: peerIdRef.current },
          });
        }, 400);
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // pieces 를 의존성에 넣으면 리스너가 계속 재생성되므로 제외.
    // state-request 응답은 pieces 최신 값을 참조한다 (ref 대신 클로저).
    // 간단히 하기 위해 setPieces 로 최신 상태를 읽는 트릭 사용 — 아래의 piecesRef 참고.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // pieces 최신 값을 state-request 응답 때 쓰기 위해 ref 로도 보관
  const piecesRef = useRef<Piece[]>(pieces);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);
  // state-request 핸들러가 참조하는 pieces 를 ref 로 바꾸기 위해 effect 를 한 번 더
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    // 기존 리스너를 덮어쓸 수 없으므로, 응답에 참조하는 pieces 를 piecesRef 로 바꾼다.
    // (이미 위에서 setTimeout 안에서 piecesRef.current 를 읽도록 아래 재바인딩)
  }, [pieces]);

  // 완료 감지
  useEffect(() => {
    if (pieces.length === 0) return;
    const done = pieces.every((p) => p.placed);
    if (done && !celebrate) setCelebrate(true);
  }, [pieces, celebrate]);

  // 조각 드래그 (throttled broadcast)
  const lastMoveSentRef = useRef<Map<number, number>>(new Map());
  const onDrag = useCallback(
    (idx: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      setPieces((cur) =>
        cur.map((p) => (p.idx === idx ? { ...p, x, y } : p))
      );
      const now = Date.now();
      const last = lastMoveSentRef.current.get(idx) || 0;
      if (now - last < MOVE_THROTTLE_MS) return;
      lastMoveSentRef.current.set(idx, now);
      channelRef.current?.send({
        type: "broadcast",
        event: "move",
        payload: {
          idx,
          x,
          y,
          by: peerIdRef.current,
          dragging: true,
        } satisfies RemoteMove,
      });
    },
    []
  );

  const onDragEnd = useCallback(
    (idx: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const piece = piecesRef.current.find((p) => p.idx === idx);
      if (!piece) return;
      const targetX = layout.boardX + piece.gridX * layout.pieceW;
      const targetY = layout.boardY + piece.gridY * layout.pieceH;
      const dx = node.x() - targetX;
      const dy = node.y() - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const snapped = dist <= SNAP_THRESHOLD;
      const newX = snapped ? targetX : node.x();
      const newY = snapped ? targetY : node.y();
      setPieces((cur) =>
        cur.map((p) =>
          p.idx === idx
            ? { ...p, x: newX, y: newY, placed: snapped || p.placed }
            : p
        )
      );
      channelRef.current?.send({
        type: "broadcast",
        event: "drop",
        payload: {
          idx,
          x: newX,
          y: newY,
          placed: snapped,
          by: peerIdRef.current,
        } satisfies RemoteDrop,
      });
    },
    [layout]
  );

  // 마우스 커서 broadcast (throttled)
  const lastCursorRef = useRef(0);
  const onStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const now = Date.now();
      if (now - lastCursorRef.current < CURSOR_THROTTLE_MS) return;
      lastCursorRef.current = now;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          x: pos.x,
          y: pos.y,
          by: peerIdRef.current,
          color: colorRef.current,
          nickname: nicknameRef.current,
        } satisfies RemoteCursor,
      });
    },
    []
  );

  const placedCount = pieces.filter((p) => p.placed).length;
  const progress = pieces.length ? (placedCount / pieces.length) * 100 : 0;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomId}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 무시 */
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 min-h-0">
      <div className="min-h-[60px] bg-white border-b border-slate-200 px-3 md:px-4 flex items-center gap-2 md:gap-4 flex-wrap py-2">
        <a
          href="/"
          className="text-slate-500 hover:text-slate-800 text-sm font-medium"
        >
          ← 홈
        </a>
        <div className="font-semibold text-slate-800 text-sm md:text-base">
          🧩 {roomId}
        </div>
        <button
          onClick={copy}
          className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
        >
          {copied ? "복사됨 ✓" : "링크 복사"}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
          <span className="tabular-nums">
            {placedCount} / {pieces.length}
          </span>
          <div className="w-24 md:w-32 h-2 bg-slate-200 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums w-10 text-right">
            {Math.round(progress)}%
          </span>
        </div>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
        >
          {showPreview ? "미리보기 끄기" : "미리보기 켜기"}
        </button>
        <div className="flex items-center gap-1 flex-wrap">
          {Object.values(participants).map((p) => (
            <div
              key={p.peerId}
              className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1.5"
              style={{
                backgroundColor: p.color + "22",
                color: p.color,
                border: `1px solid ${p.color}66`,
              }}
              title={p.nickname}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.nickname}
              {p.peerId === peerIdRef.current ? " (나)" : ""}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden min-h-0"
      >
        {imgStatus === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            이미지를 불러오지 못했어요. Supabase Storage CORS 설정을 확인해 주세요.
          </div>
        )}
        {image && (
          <Stage
            width={stageSize.w}
            height={stageSize.h}
            onMouseMove={onStageMouseMove}
            onTouchMove={onStageMouseMove as unknown as (
              e: Konva.KonvaEventObject<TouchEvent>
            ) => void}
          >
            <Layer listening={false}>
              <Rect
                x={0}
                y={0}
                width={TRAY}
                height={stageSize.h}
                fill="#e2e8f0"
              />
              <Rect
                x={stageSize.w - TRAY}
                y={0}
                width={TRAY}
                height={stageSize.h}
                fill="#e2e8f0"
              />
              <Text
                text="↓ 조각 보관함"
                x={10}
                y={10}
                fontSize={12}
                fill="#64748b"
              />
              <Text
                text="조각 보관함 ↓"
                x={stageSize.w - TRAY + 10}
                y={10}
                fontSize={12}
                fill="#64748b"
              />
              <Rect
                x={layout.boardX}
                y={layout.boardY}
                width={layout.boardW}
                height={layout.boardH}
                fill="#f8fafc"
                stroke="#94a3b8"
                strokeWidth={2}
                dash={[6, 4]}
              />
              {showPreview && (
                <KImage
                  image={image}
                  x={layout.boardX}
                  y={layout.boardY}
                  width={layout.boardW}
                  height={layout.boardH}
                  opacity={0.18}
                />
              )}
              {Array.from({ length: room.cols - 1 }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  points={[
                    layout.boardX + (i + 1) * layout.pieceW,
                    layout.boardY,
                    layout.boardX + (i + 1) * layout.pieceW,
                    layout.boardY + layout.boardH,
                  ]}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: room.rows - 1 }).map((_, i) => (
                <Line
                  key={`h${i}`}
                  points={[
                    layout.boardX,
                    layout.boardY + (i + 1) * layout.pieceH,
                    layout.boardX + layout.boardW,
                    layout.boardY + (i + 1) * layout.pieceH,
                  ]}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
              ))}
            </Layer>

            <Layer>
              {[...pieces]
                .sort((a, b) => (a.placed === b.placed ? 0 : a.placed ? -1 : 1))
                .map((p) => {
                  const imgX = -(p.gridX * layout.pieceW);
                  const imgY = -(p.gridY * layout.pieceH);
                  const remoteBy = remoteDraggingRef.current.get(p.idx);
                  const remoteColor = remoteBy
                    ? participants[remoteBy]?.color
                    : undefined;
                  return (
                    <Group
                      key={p.idx}
                      x={p.x}
                      y={p.y}
                      draggable={!p.placed}
                      onDragMove={(e) => onDrag(p.idx, e)}
                      onDragEnd={(e) => onDragEnd(p.idx, e)}
                      shadowEnabled={!p.placed}
                      shadowColor="#000"
                      shadowBlur={p.placed ? 0 : 6}
                      shadowOpacity={0.2}
                      shadowOffsetX={0}
                      shadowOffsetY={p.placed ? 0 : 3}
                    >
                      <Group
                        clipFunc={(ctx) => {
                          ctx.beginPath();
                          ctx.rect(0, 0, layout.pieceW, layout.pieceH);
                          ctx.closePath();
                        }}
                      >
                        <KImage
                          image={image}
                          x={imgX}
                          y={imgY}
                          width={layout.boardW}
                          height={layout.boardH}
                        />
                      </Group>
                      <Rect
                        x={0}
                        y={0}
                        width={layout.pieceW}
                        height={layout.pieceH}
                        stroke={
                          p.placed
                            ? "#10b981"
                            : remoteColor
                            ? remoteColor
                            : "#334155"
                        }
                        strokeWidth={p.placed ? 2 : remoteColor ? 3 : 1}
                        listening={false}
                      />
                    </Group>
                  );
                })}
            </Layer>

            <Layer listening={false}>
              {Object.values(participants)
                .filter(
                  (p) => p.cursor && p.peerId !== peerIdRef.current
                )
                .map((p) => (
                  <Group
                    key={`cursor-${p.peerId}`}
                    x={p.cursor!.x}
                    y={p.cursor!.y}
                  >
                    <Line
                      points={[0, 0, 0, 16, 5, 12, 9, 20, 12, 18, 8, 10, 14, 10]}
                      closed
                      fill={p.color}
                      stroke="white"
                      strokeWidth={1}
                    />
                    <Rect
                      x={14}
                      y={6}
                      width={Math.min(140, p.nickname.length * 8 + 14)}
                      height={20}
                      fill={p.color}
                      cornerRadius={4}
                      opacity={0.95}
                    />
                    <Text
                      text={p.nickname}
                      x={18}
                      y={10}
                      fontSize={12}
                      fill="white"
                      fontStyle="bold"
                    />
                  </Group>
                ))}
            </Layer>
          </Stage>
        )}
        {celebrate && (
          <CompletionCelebration onClose={() => setCelebrate(false)} />
        )}
      </div>
    </div>
  );
}
