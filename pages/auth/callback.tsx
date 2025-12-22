// pages/auth/callback.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      // Supabase automatically sets session here
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        router.replace("/auth");
        return;
      }

      // Check first mission flag
      const { data: flag } = await supabase
        .from("user_flags")
        .select("first_mission_done")
        .eq("user_id", data.user.id)
        .single();

      if (!flag || !flag.first_mission_done) {
        router.replace("/first-mission");
      } else {
        router.replace("/");
      }
    }

    handleCallback();
  }, [router]);

  return null;
}