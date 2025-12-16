import { Geist, Geist_Mono, Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ClientToastProvider } from "./components/ClientToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Memora - Modern Gift Registry Platform",
  description: "Create beautiful gift registries, let friends contribute together, and receive gifts you'll actually love. Free forever, no credit card required.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${outfit.variable} antialiased`}
      >
        <ClientToastProvider>{children}</ClientToastProvider>
      </body>
    </html>
  );
}
