import { listSubjects } from "@/admin/queries";
import { BookForm } from "@/components/admin/BookForm";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";

export default async function NewBookPage() {
  await connectDb();
  const subjects = await listSubjects();
  return (
    <AdminPage title="New book" back={{ href: "/admin/books", label: "Question books" }}>
      <AdminCard>
        <BookForm subjects={subjects} />
      </AdminCard>
    </AdminPage>
  );
}
