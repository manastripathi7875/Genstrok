import type { NextConfig } from "next";
import { env } from "process";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...(env.REPLIT_DOMAINS?.split(",") || []),
    ...(env.REPLIT_DOMAINS?.split(",").map((domain: string) => domain.replace('.replit.dev', '.repl.co')) || []),
  ],
};

export default nextConfig;
