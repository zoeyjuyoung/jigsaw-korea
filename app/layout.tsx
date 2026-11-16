import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한글 직소 퍼즐 — 친구들과 함께 맞추기",
  description: "이미지를 업로드하고 친구들과 실시간으로 함께 맞추는 한글 직소 퍼즐",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
