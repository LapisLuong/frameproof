// Server only. Keep this module out of client components.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authOrigin, safeAuthReturn } from "./security/export-access";

export const { handlers, auth } = NextAuth(() => {
  const origin = authOrigin();
  return {
    providers: origin ? [Google({ checks: ["pkce", "state", "nonce"] })] : [],
    trustHost: Boolean(origin),
    useSecureCookies: origin?.protocol === "https:",
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    callbacks: {
      signIn: ({ account, profile }) => account?.provider === "google" && profile?.email_verified === true,
      redirect: ({ url }) => origin ? safeAuthReturn(url, origin) : "/",
    },
  };
});
