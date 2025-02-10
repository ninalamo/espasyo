import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const res = await fetch("http://localhost:3001/users");
                const users = await res.json();
                const user = users.find(
                    (u) => u.username === credentials.username && u.password === credentials.password
                );

                if (user) {
                    return {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        token: `jwt-${user.token}`, // Replace with real token if available
                    };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: "/login", // Custom login page
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.email = user.email;
                token.token = user.token; // Store the JWT in the session
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                id: token.id,
                username: token.username,
                email: token.email,
                token: token.token, // Include the JWT token in the session
            };
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET, // Set this in `.env.local`
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
