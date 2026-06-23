import "./globals.css";
import AuthProvider from "../components/AuthProvider";

export const metadata = {
  title: "Linear Ventures Mail",
  description: "A premium, custom email client and organizer.",
  manifest: "/manifest.json",
  themeColor: "#030712",
  icons: {
    icon: "/logo-lv.png",
    apple: "/logo-lv.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Linear Ventures Mail",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
