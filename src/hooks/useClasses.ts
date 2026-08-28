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
