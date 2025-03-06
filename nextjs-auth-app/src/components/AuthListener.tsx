'use client';
// components/AuthListener.tsx

import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function AuthListener() {
  const { data: session } = useSession();

  useEffect(() => {
    console.log('Session', session);
    if (session?.user?.name) {
      // Store username when session exists
      localStorage.setItem("username", session.user.name);
       localStorage.setItem("token", session.user.token);
    } else {
      // Remove token and username when session is cleared
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    }
  }, [session]);

  return null;
}
