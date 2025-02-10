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
                // Simulating fetching users (replace with DB query)
                const res = await fetch("http://localhost:3001/users");
                const users = await res.json();
                const user = users.find(
                    (u) => u.username === credentials.username && u.password === credentials.password
                );

                if (user) {
                    return user;
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
    secret: process.env.NEXTAUTH_SECRET, // Set this in `.env.local`
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
