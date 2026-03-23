"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { ApiProfile } from "@/types/settings";

type ApiProfilesStatus = "idle" | "loading" | "loaded" | "empty" | "error";

interface ApiProfilesContextValue {
  profiles: ApiProfile[];
  status: ApiProfilesStatus;
  isLoading: boolean;
  hasLoaded: boolean;
  errorMessage: string | null;
  refreshProfiles: () => Promise<void>;
  createProfile: (value: Omit<ApiProfile, "id">) => Promise<ApiProfile>;
  updateProfile: (id: string, value: Omit<ApiProfile, "id">) => Promise<ApiProfile>;
  deleteProfile: (id: string) => Promise<void>;
}

interface ApiProfilesCacheState {
  userId: string | null;
  profiles: ApiProfile[];
  status: ApiProfilesStatus;
}

const apiProfilesCache: ApiProfilesCacheState = {
  userId: null,
  profiles: [],
  status: "idle",
};

const ApiProfilesContext = createContext<ApiProfilesContextValue | undefined>(undefined);

function mapRowsToProfiles(rows: Array<{ id: string; name: string; provider: string; model: string }>): ApiProfile[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    apiKey: "",
  }));
}

export function ApiProfilesProvider({ children }: { children: React.ReactNode }) {
  const { authResolved, session, user } = useAuth();
  const [profiles, setProfiles] = useState<ApiProfile[]>(() => apiProfilesCache.profiles);
  const [status, setStatus] = useState<ApiProfilesStatus>(() => apiProfilesCache.status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshProfiles = useCallback(async () => {
    if (!authResolved || !user || !session?.access_token) {
      setProfiles([]);
      setStatus("idle");
      setErrorMessage(null);
      apiProfilesCache.userId = null;
      apiProfilesCache.profiles = [];
      apiProfilesCache.status = "idle";
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("api_profiles")
      .select("id, name, provider, model, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to load API profiles from Supabase.", error);
      setProfiles([]);
      setStatus("error");
      setErrorMessage(error.message || "Could not load API profiles.");
      apiProfilesCache.userId = user.id;
      apiProfilesCache.profiles = [];
      apiProfilesCache.status = "error";
      return;
    }

    const nextProfiles = mapRowsToProfiles((data ?? []) as Array<{ id: string; name: string; provider: string; model: string }>);
    const nextStatus: ApiProfilesStatus = nextProfiles.length > 0 ? "loaded" : "empty";

    setProfiles(nextProfiles);
    setStatus(nextStatus);
    apiProfilesCache.userId = user.id;
    apiProfilesCache.profiles = nextProfiles;
    apiProfilesCache.status = nextStatus;
  }, [authResolved, session?.access_token, user]);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    queueMicrotask(() => {
      void refreshProfiles();
    });
  }, [authResolved, refreshProfiles]);

  const createProfile = useCallback(async (value: Omit<ApiProfile, "id">) => {
    if (!user) {
      throw new Error("You must be signed in to create API profiles.");
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("api_profiles")
      .insert({
        user_id: user.id,
        name: value.name,
        provider: value.provider,
        model: value.model,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, name, provider, model")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create API profile.");
    }

    const createdProfile: ApiProfile = {
      id: data.id,
      name: data.name,
      provider: data.provider,
      model: data.model,
      apiKey: value.apiKey,
    };

    setProfiles((prev) => {
      const next = [createdProfile, ...prev];
      apiProfilesCache.profiles = next;
      apiProfilesCache.status = "loaded";
      return next;
    });
    setStatus("loaded");
    setErrorMessage(null);

    return createdProfile;
  }, [user]);

  const updateProfile = useCallback(async (id: string, value: Omit<ApiProfile, "id">) => {
    if (!user) {
      throw new Error("You must be signed in to update API profiles.");
    }

    const { data, error } = await supabase
      .from("api_profiles")
      .update({
        name: value.name,
        provider: value.provider,
        model: value.model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, provider, model")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not update API profile.");
    }

    const updatedProfile: ApiProfile = {
      id: data.id,
      name: data.name,
      provider: data.provider,
      model: data.model,
      apiKey: value.apiKey,
    };

    setProfiles((prev) => {
      const next = prev.map((profile) => (profile.id === id ? updatedProfile : profile));
      apiProfilesCache.profiles = next;
      apiProfilesCache.status = next.length > 0 ? "loaded" : "empty";
      return next;
    });
    setStatus((prev) => (prev === "empty" ? "loaded" : prev));
    setErrorMessage(null);

    return updatedProfile;
  }, [user]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!user) {
      throw new Error("You must be signed in to delete API profiles.");
    }

    const { error } = await supabase
      .from("api_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    setProfiles((prev) => {
      const next = prev.filter((profile) => profile.id !== id);
      const nextStatus = next.length > 0 ? "loaded" : "empty";
      apiProfilesCache.profiles = next;
      apiProfilesCache.status = nextStatus;
      setStatus(nextStatus);
      return next;
    });
    setErrorMessage(null);
  }, [user]);

  const value = useMemo<ApiProfilesContextValue>(() => ({
    profiles,
    status,
    isLoading: status === "loading",
    hasLoaded: status === "loaded" || status === "empty",
    errorMessage,
    refreshProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
  }), [createProfile, deleteProfile, errorMessage, profiles, refreshProfiles, status, updateProfile]);

  return <ApiProfilesContext.Provider value={value}>{children}</ApiProfilesContext.Provider>;
}

export function useApiProfiles() {
  const context = useContext(ApiProfilesContext);

  if (!context) {
    throw new Error("useApiProfiles must be used within an ApiProfilesProvider.");
  }

  return context;
}
