// pages/admin/index.tsx
import dynamic from "next/dynamic";
import Head from "next/head";

const AdminClient = dynamic(() => import("../../components/admin/AdminClient"), {
  ssr: false,
});

export default function AdminPageWrapper() {
  return (
    <>
      <Head>
        <title>Admin — Genstrok</title>
      </Head>
      <AdminClient />
    </>
  );
}