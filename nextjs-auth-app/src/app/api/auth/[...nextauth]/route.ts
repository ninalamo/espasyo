import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Define the shape of the user object
interface CustomUser extends User {
  username: string;
  token: string;
}

// Determine the API URL based on environment variables:
// Always use NEXT_PUBLIC_API_URL if provided; otherwise fallback to local API.
// Remove fallback to NEXTAUTH_URL to avoid misrouting to the frontend.
const API_URL = `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5041/api").replace(/\/$/, "")}/user`;



export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("NextAuth authorize -> API_URL:", API_URL);
          
          // Configure fetch to ignore self-signed certificates in development
          const fetchOptions: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          };
          
          // In development, ignore certificate errors
          if (process.env.NODE_ENV === 'development') {
            // @ts-ignore
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          }
          
          const res = await fetch(API_URL, fetchOptions);

          console.log("Response status:", res.status);

          if (!res.ok) {
            const errorBody = await res.text();
            console.error("Error response body:", errorBody);
            throw new Error("Invalid credentials");
          }

          const user = await res.json();
          console.log("API response:", user);

          if (user && user.token) {
            return {
              id: credentials?.email || "user", // Use email as ID since API doesn't return one
              name: user.username || credentials?.email,
              email: credentials?.email,
              username: user.username || credentials?.email || "",
              token: user.token,
            } as CustomUser;
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      const customUser = user as CustomUser;
      if (customUser) {
        token.id = customUser.id;
        token.name = (customUser as any).name ?? customUser.username;
        token.email = (customUser as any).email ?? customUser.email;
        token.token = (customUser as any).token ?? customUser.token;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        token: token.token,
      } as Session["user"];
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Export NextAuth handler for both GET and POST requests
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

