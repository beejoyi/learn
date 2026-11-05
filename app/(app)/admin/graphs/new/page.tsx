import { listSubjects } from "@/admin/queries";
import { GraphForm } from "@/components/admin/GraphForm";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";

export default async function NewGraphPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New graph" back={{ href: "/admin/graphs", label: "Graphs" }}>
      <AdminCard>
        <GraphForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
