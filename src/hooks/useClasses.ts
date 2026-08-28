import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ClassRoom = { id: string; name: string; created_at: string };

export function useClasses() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async (): Promise<ClassRoom[]> => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, created_at")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassRoom[];
    },
  });
}

export function useClassMembers(classId: string | null) {
  return useQuery({
    queryKey: ["class-members", classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("class_members")
        .select("student_id")
        .eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.student_id);
    },
  });
}

export function useCreateClass() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<ClassRoom> => {
      const { data, error } = await supabase
        .from("classes")
        .insert({ name, teacher_id: session!.user.id })
        .select("id, name, created_at")
        .single();
      if (error) throw error;
      return data as ClassRoom;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useRenameClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("classes").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useClassTeachers(classId: string | null) {
  return useQuery({
    queryKey: ["class-teachers", classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("class_teachers")
        .select("teacher_id")
        .eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.teacher_id);
    },
  });
}

/** Promove o aluno a professor e o autoriza nesta sala. */
export function useAuthorizeTeacher(classId: string | null) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, authorized }: { userId: string; authorized: boolean }) => {
      if (authorized) {
        const { error } = await supabase
          .from("class_teachers")
          .delete()
          .eq("class_id", classId!)
          .eq("teacher_id", userId);
        if (error) throw error;
        return;
      }
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "teacher" });
      // 23505: já era professor
      if (roleError && roleError.code !== "23505") throw roleError;
      const { error } = await supabase
        .from("class_teachers")
        .insert({ class_id: classId!, teacher_id: userId, added_by: session!.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-teachers", classId] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

export function useToggleClassMember(classId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, member }: { studentId: string; member: boolean }) => {
      if (member) {
        const { error } = await supabase
          .from("class_members")
          .delete()
          .eq("class_id", classId!)
          .eq("student_id", studentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_members")
          .insert({ class_id: classId!, student_id: studentId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["class-members", classId] }),
  });
}
