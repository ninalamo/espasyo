import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Define the shape of the user object
interface CustomUser extends User {
    username: string;
    token: string;
}

// Determine the API URL based on the environment
const API_URL = process.env.NODE_ENV === "development"
    ? "http://localhost:3001/users"  // JSON-Server for local development
    : "https://your-production-api.com/auth/login"; // Replace with actual production API

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
                    let user;

                    if (process.env.NODE_ENV === "development") {
                        // Fetch from json-server
                        const res = await fetch(API_URL);
                        const users = await res.json();
                        user = users.find(
                            (u) => u.email === credentials?.email && u.password === credentials?.password
                        );
                    } else {
                        // Make a POST request to the production API
                        const res = await fetch(API_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                email: credentials?.email,
                                password: credentials?.password,
                            }),
                        });

                        if (!res.ok) throw new Error("Invalid credentials");

                        user = await res.json();
                    }

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

// Export NextAuth handler for both GET and POST
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
