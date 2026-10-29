import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ClassRoom = {
  id: string;
  name: string;
  created_at: string;
  teacher_id: string;
};

export function useClasses() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["classes", session?.user.id],
    enabled: Boolean(session),
    queryFn: async (): Promise<ClassRoom[]> => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, created_at, teacher_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassRoom[];
    },
  });
}

export function useClassMembers(classId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["class-members", classId, session?.user.id],
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
        .select("id, name, created_at, teacher_id")
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

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("classes").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não tem permissão para excluir esta sala");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["class-history"] });
    },
  });
}

export function useClassTeachers(classId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["class-teachers", classId, session?.user.id],
    enabled: Boolean(classId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("class_teachers")
        .select("teacher_id")
        .eq("class_id", classId!);
      if (error) throw error;
      const { data: room, error: roomError } = await supabase
        .from("classes")
        .select("teacher_id")
        .eq("id", classId!)
        .single();
      if (roomError) throw roomError;
      return [...new Set([room.teacher_id, ...(data ?? []).map((row) => row.teacher_id)])];
    },
  });
}

/** Promove o aluno a professor e o autoriza nesta sala. */
export function useAuthorizeTeacher(classId: string | null) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      authorized,
    }: {
      userId: string;
      authorized: boolean;
    }): Promise<{ demoted: boolean }> => {
      if (authorized) {
        const { data, error } = await supabase.rpc("revoke_teacher", {
          _user_id: userId,
          _class_id: classId!,
        });
        if (error) throw error;
        return { demoted: data === true };
      }
      const { error: roleError } = await supabase.rpc("promote_to_teacher", {
        _user_id: userId,
        _class_id: classId!,
      });
      if (roleError) throw roleError;
      const { error } = await supabase
        .from("class_teachers")
        .insert({ class_id: classId!, teacher_id: userId, added_by: session!.user.id });
      if (error) throw error;
      return { demoted: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-teachers", classId] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["everyone"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["class-members"] });
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
