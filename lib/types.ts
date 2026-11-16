export type Piece = {
  idx: number;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  placed: boolean;
};

export type RoomMeta = {
  id: string;
  image_url: string;
  image_w: number;
  image_h: number;
  cols: number;
  rows: number;
  piece_w: number;
  piece_h: number;
  created_at?: string;
};

export type Presence = {
  nickname: string;
  color: string;
  peerId: string;
};

export type Participant = Presence & {
  cursor?: { x: number; y: number };
};
