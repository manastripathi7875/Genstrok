import { useRouter } from "next/router";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1a1a2e, #000)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        color: "#fff",
        textAlign: "center",
      }}
    >
      {/* Brand */}
      <h2 style={{ opacity: 0.8, letterSpacing: 2 }}>GENSTROK</h2>

      {/* Main promise */}
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          marginTop: 24,
          marginBottom: 16,
          lineHeight: 1.2,
        }}
      >
        Roz aao.<br />
        Chhota kaam karo.<br />
        Paisa kamao.
      </h1>

      {/* Explanation */}
      <p
        style={{
          maxWidth: 420,
          fontSize: 15,
          opacity: 0.85,
          marginBottom: 32,
        }}
      >
        Genstrok me skill, course ya investment nahi chahiye.
        Sirf participate karo, ownership lo aur rewards pao.
      </p>

      {/* CTA */}
      <button
        onClick={() => router.push("/login")}
        style={{
          padding: "14px 28px",
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 999,
          border: "none",
          background:
            "linear-gradient(90deg, #7f5cff, #b84cff)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Start Earning
      </button>

      {/* Trust text */}
      <p
        style={{
          marginTop: 20,
          fontSize: 12,
          opacity: 0.6,
        }}
      >
        No spam • No fake promises • Real participation
      </p>
    </div>
  );
}