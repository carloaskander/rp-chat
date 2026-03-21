"use client";

import {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authResolved: boolean;
  lastAuthEvent: AuthChangeEvent | null;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthChangeEvent | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error("Failed to get Supabase session", error);
        }
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLastAuthEvent("INITIAL_SESSION");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          setAuthResolved(true);
        }
      });

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setLastAuthEvent(event);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setIsLoading(false);
        setAuthResolved(true);
      },
    );

    return () => {
      isMounted = false;
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      authResolved,
      lastAuthEvent,
      signInWithGoogle: async () => {
        const redirectTo =
          typeof window === "undefined" ? undefined : window.location.href;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
        if (error) {
          throw error;
        }
      },
      sendMagicLink: async (email: string) => {
        const redirectTo =
          typeof window === "undefined" ? undefined : window.location.href;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
          },
        });
        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [user, session, isLoading, authResolved, lastAuthEvent],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
