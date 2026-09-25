import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "teacher" | "student";

export type Profile = {
  id: string;
  name: string;
  email: string;
  total_points: number;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  isMaster: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(userId: string) {
    const [{ data: prof }, { data: roles }, { data: master }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, email, total_points")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("masters").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    setProfile((prof as Profile | null) ?? null);
    const found = roles?.[0]?.role as Role | undefined;
    setIsMaster(Boolean(master));
    setRole(master ? "teacher" : (found ?? null));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setRole(null);
        setIsMaster(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await load(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    load(session.user.id).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const value: AuthState = {
    session,
    profile,
    role,
    isMaster,
    loading,
    refresh: async () => {
      if (session) await load(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setRole(null);
      setIsMaster(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
