import { notFound } from "next/navigation";
import { getSeriesAdmin, listSubjects } from "@/admin/queries";
import { NoteForm } from "@/components/admin/NoteForm";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";

export default async function NewChapterPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  await connectDb();
  const [data, subjects] = await Promise.all([
    getSeriesAdmin(seriesId),
    listSubjects(),
  ]);
  if (!data) notFound();
  return (
    <AdminPage title="New chapter" back={{ href: `/admin/notes/${seriesId}`, label: data.series.title }}>
      <AdminCard>
        <NoteForm
          note={{
            id: "",
            seriesId,
            slug: "",
            title: "",
            body: "",
            subjects: data.series.subjects,
            status: "draft",
          }}
          subjects={subjects}
        />
      </AdminCard>
    </AdminPage>
  );
}
