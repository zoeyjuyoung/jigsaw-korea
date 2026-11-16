import PuzzleRoomClient from "./PuzzleRoomClient";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <PuzzleRoomClient roomId={roomId} />;
}
