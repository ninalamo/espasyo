import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Define the shape of the user object
interface CustomUser extends User {
    username: string;  // Add custom field for username
    token: string;     // Add custom token field
}

// Define the NextAuth options with correct types
export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const res = await fetch("http://localhost:3001/users");
                const users = await res.json();
                const user = users.find(
                    (u) => u.email === credentials?.email && u.password === credentials?.password
                );

                if (user) {
                    return {
                        id: user.id,
                        name: user.username, // Use username as the 'name' for session
                        email: user.email,
                        token: `jwt-${user.token}`, // Replace with real token if available
                    } as CustomUser; // Cast to CustomUser type
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
                const customUser = user as CustomUser;
                token.name = customUser.username; // Set name in the JWT
                token.email = customUser.email;
                token.token = customUser.token; // Store the JWT in the session
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                id: token.id,
                name: token.name,  // Ensure name is accessed correctly from token
                email: token.email,
                token: token.token, // Include the JWT token in the session
            } as Session["user"]; // Cast to Session['user'] type
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET, // Set this in `.env.local`
};

// The handler is exported as both GET and POST
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
