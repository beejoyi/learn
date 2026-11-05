import { notFound } from "next/navigation";
import { getBookAdmin, getQuestionAdmin, listSubjects } from "@/admin/queries";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { connectDb } from "@/lib/db";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ bookId: string; questionId: string }>;
}) {
  const { bookId, questionId } = await params;
  await connectDb();
  const [book, data, subjects] = await Promise.all([
    getBookAdmin(bookId),
    getQuestionAdmin(questionId),
    listSubjects(),
  ]);
  if (!book || !data || data.question.bookId !== bookId) notFound();

  return (
    <AdminPage title="Edit question" back={{ href: `/admin/books/${bookId}`, label: book.book.title }}>
      <AdminCard>
        <QuestionForm
          question={data.question}
          parts={book.book.parts}
          subjects={subjects}
          topics={data.topics}
        />
      </AdminCard>
    </AdminPage>
  );
}
