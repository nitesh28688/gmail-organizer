import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "../../../../lib/prisma"
function ensureAuthUrl() {
  if (process.env.NEXTAUTH_URL?.startsWith("http://") || process.env.NEXTAUTH_URL?.startsWith("https://")) {
    return;
  }

  if (process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return;
  }

  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

ensureAuthUrl();

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/gmail.settings.sharing"
        }
      }
    }),
  ],
  pages: {
    signIn: '/',
    error: '/auth/error', // Custom error page
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
