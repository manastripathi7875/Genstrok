// pages/login.tsx

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/auth");
    },);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020616] text-slate-50">
      <div className="flex flex-col items-center gap-4">
        {/* Loader */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border border-violet-500/30" />
          <div className="absolute inset-1 rounded-full border-t-2 border-violet-400 animate-spin" />
        </div>

        {/* Text */}
        <p className="text-xs text-slate-400">
          Preparing your Genstrok account
        </p>
      </div>
    </div>
  );
}