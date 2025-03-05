import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Define the shape of the user object
interface CustomUser extends User {
  username: string;
  token: string;
}

// Determine the API URL based on environment variables:
// Use NEXT_PUBLIC_API_URL (with "/user" appended) if available,
// Otherwise, fallback to NEXTAUTH_URL.
const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/user`
  : process.env.NEXTAUTH_URL;



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
          const isJsonServer = API_URL.endsWith("users");
          const method = isJsonServer ? "GET" : "POST";
          const res = await fetch(API_URL, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          console.log("Response status:", res.status);

          if (!res.ok) {
            const errorBody = await res.text();
            console.error("Error response body:", errorBody);
            throw new Error("Invalid credentials");
          }

          const user = await res.json();

          if (user) {
            return {
              id: user.id,
              name: user.username,
              email: user.email,
              token: user.token, // Store token if available
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
        token.name = customUser.username;
        token.email = customUser.email;
        token.token = customUser.token;
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
