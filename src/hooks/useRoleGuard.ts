import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type Role } from "@/hooks/useAuth";

/** Garante que a rota só renderiza para o perfil correto. */
export function useRoleGuard(required: Role) {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (role && role !== required) {
      navigate({ to: role === "teacher" ? "/professor" : "/aluno", replace: true });
    }
  }, [session, role, loading, required, navigate]);

  return { ready: !loading && !!session && role === required };
}
