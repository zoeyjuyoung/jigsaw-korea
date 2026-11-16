import type { Piece } from "./types";

// 조각 수에 가장 가까운 격자 (cols x rows) 를 이미지 비율에 맞춰 계산
export function pickGrid(
  totalPieces: number,
  imageW: number,
  imageH: number
): { cols: number; rows: number } {
  const ratio = imageW / imageH;
  const rows = Math.max(2, Math.round(Math.sqrt(totalPieces / ratio)));
  const cols = Math.max(2, Math.round(totalPieces / rows));
  return { cols, rows };
}

// seed 기반 결정적 난수 — 모든 참가자가 같은 초기 배치를 보도록
function makeRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

// 양쪽 트레이에 조각을 무작위로 배치한다 (seed 로 결정적)
export function initPieces(args: {
  cols: number;
  rows: number;
  pieceW: number;
  pieceH: number;
  trayLeftW: number;
  trayRightW: number;
  stageW: number;
  stageH: number;
  seed: number;
}): Piece[] {
  const { cols, rows, pieceW, pieceH, trayLeftW, trayRightW, stageW, stageH, seed } = args;
  const rand = makeRng(seed);
  const pieces: Piece[] = [];
  const margin = 10;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const idx = gy * cols + gx;
      const useLeft = rand() < 0.5;
      const trayW = useLeft ? trayLeftW : trayRightW;
      const trayX = useLeft ? 0 : stageW - trayRightW;
      const x = trayX + margin + rand() * Math.max(10, trayW - pieceW - margin * 2);
      const y = margin + rand() * Math.max(10, stageH - pieceH - margin * 2);
      pieces.push({ idx, gridX: gx, gridY: gy, x, y, placed: false });
    }
  }
  return pieces;
}

// 스냅 거리 (px)
export const SNAP_THRESHOLD = 24;
