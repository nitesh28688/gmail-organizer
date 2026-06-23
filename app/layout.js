import "./globals.css";
import AuthProvider from "../components/AuthProvider";

export const viewport = {
  themeColor: "#030712",
};

export const metadata = {
  title: "Linear Mail",
  description: "A premium, custom email client and organizer.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Linear Mail",
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
