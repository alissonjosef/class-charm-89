import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Student = { id: string; name: string; email: string; total_points: number };

export type Person = {
  id: string;
  name: string;
  email: string;
  isTeacher: boolean;
  isMaster: boolean;
};

/** Todas as pessoas cadastradas (alunos e professores), com o papel atual. */
export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async (): Promise<Person[]> => {
      const [profilesRes, rolesRes, mastersRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("masters").select("user_id"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (mastersRes.error) throw mastersRes.error;
      const teachers = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "teacher").map((r) => r.user_id),
      );
      const masters = new Set((mastersRes.data ?? []).map((m) => m.user_id));
      return (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        isTeacher: teachers.has(p.id) || masters.has(p.id),
        isMaster: masters.has(p.id),
      }));
    },
  });
}

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async (): Promise<Student[]> => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, total_points")
        .in("id", ids)
        .order("total_points", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}
