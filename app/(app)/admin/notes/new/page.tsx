import { listSubjects } from "@/admin/queries";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";

export default async function NewSeriesPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New series" back={{ href: "/admin/notes", label: "Note series" }}>
      <AdminCard>
        <SeriesForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
