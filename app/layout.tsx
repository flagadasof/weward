import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://weward-gules.vercel.app"),
  title: "Wardy BIP",
  description:
    "Vérifiez les profils signalés et consultez les informations disponibles.",
  openGraph: {
    title: "Wardy BIP",
    description:
      "Vérifiez les profils signalés et consultez les informations disponibles.",
    url: "https://weward-gules.vercel.app/",
    images: [
      {
url: "https://weward-gules.vercel.app/og-image.png?v=2",
        width: 1402,
        height: 1122,
        alt: "Wardy BIP",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
