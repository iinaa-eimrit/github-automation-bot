import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "./db";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      githubId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user repo admin:repo_hook",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubId = String(profile.id);
        const username = (profile.login as string) || user.name || "Unknown";
        const avatarUrl = (profile.avatar_url as string) || user.image || null;

        await db.user.upsert({
          where: { githubId },
          update: {
            username,
            avatarUrl,
          },
          create: {
            githubId,
            username,
            avatarUrl,
          },
        });
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile?.id) {
        token.githubId = String(profile.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (token?.githubId && session.user) {
        session.user.githubId = token.githubId as string;
      }
      return session;
    },
  },
});
