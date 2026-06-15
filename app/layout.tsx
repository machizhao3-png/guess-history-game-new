import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "猜历史人物",
  description: "多人共享同一位历史人物，用五种限定回答逐步猜出答案。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
