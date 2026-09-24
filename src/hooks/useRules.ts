import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Rule, RuleGroup } from "@/lib/points";

export type RulesData = { groups: RuleGroup[]; rules: Rule[] };

export function useRules() {
  return useQuery({
    queryKey: ["point-rules"],
    queryFn: async (): Promise<RulesData> => {
      const [groupsRes, rulesRes] = await Promise.all([
        supabase.from("point_groups").select("id, name, sort_order").order("sort_order"),
        supabase
          .from("point_rules")
          .select("id, group_id, key, label, points, sort_order")
          .order("sort_order"),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (rulesRes.error) throw rulesRes.error;
      return { groups: groupsRes.data ?? [], rules: rulesRes.data ?? [] };
    },
  });
}

function slugKey(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 40);
  return `${base || "REGRA"}_${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export function useRuleMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["point-rules"] });

  const createGroup = useMutation({
    mutationFn: async ({ name, sortOrder }: { name: string; sortOrder: number }) => {
      const { error } = await supabase.from("point_groups").insert({ name, sort_order: sortOrder });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const renameGroup = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("point_groups").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("point_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const createRule = useMutation({
    mutationFn: async ({
      groupId,
      label,
      points,
      sortOrder,
    }: {
      groupId: string;
      label: string;
      points: number;
      sortOrder: number;
    }) => {
      const { error } = await supabase
        .from("point_rules")
        .insert({ group_id: groupId, key: slugKey(label), label, points, sort_order: sortOrder });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, label, points }: { id: string; label: string; points: number }) => {
      const { error } = await supabase.from("point_rules").update({ label, points }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("point_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { createGroup, renameGroup, deleteGroup, createRule, updateRule, deleteRule };
}
