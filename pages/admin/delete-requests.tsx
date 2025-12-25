import { useEffect, useState } from "react";

export default function DeleteRequestsPage() {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await fetch("/api/admin/delete-requests", {
      method: "POST",
    });
    setLoading(false);
    alert("Processed");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Delete Requests</h1>
      <button onClick={handleDelete} disabled={loading}>
        {loading ? "Processing..." : "Process Delete Requests"}
      </button>
    </div>
  );
}