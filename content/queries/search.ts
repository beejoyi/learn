import type { Types } from "mongoose";
import { visibleNodeFilter, visibleNoteFilter, visibleQuestionFilter } from "@/content/visibility";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

type Id = Types.ObjectId;

export type SearchHit = {
  kind: "question" | "topic" | "chapter";
  /** The matched thing: a question, a graph topic or a chapter. */
  title: string;
  /** Where it lives — the book, graph or series it belongs to. */
  context: string;
  href: string;
};

/** Per kind, so one content type cannot crowd the others out of the list. */
const PER_KIND = 6;
export const SEARCH_MIN = 2;

/**
 * Question text is markdown; the palette lists one plain line per hit, so inline markers come off.
 * Matching still runs against the stored text, so a term inside backticks is still found.
 */
function plain(md: string): string {
  return md
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** A user's term is a literal, not a pattern: escape it before it reaches a regex. */
function term(input: string): RegExp {
  return new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/** Maps parent ids to the fields a hit needs from them. */
async function parents<T extends { _id: Id }>(
  model: { find: (f: object, p: object) => { lean: <R>() => Promise<R> } },
  ids: Id[],
): Promise<Map<string, T>> {
  if (!ids.length) return new Map();
  const rows = await model.find({ _id: { $in: ids } }, { slug: 1, title: 1 }).lean<T[]>();
  return new Map(rows.map((row) => [String(row._id), row]));
}

type Parent = { _id: Id; slug: string; title: string };

/**
 * Titles matching `input` across every content type the user can see, for the command palette.
 * Questions match on their question text, topics and chapters on their title; bodies are left out
 * on purpose, so a hit is always something the user can read in the list.
 */
export async function searchContent(input: string): Promise<SearchHit[]> {
  const query = input.trim();
  if (query.length < SEARCH_MIN) return [];
  const match = term(query);

  const [questions, nodes, notes] = await Promise.all([
    Question.find({ ...(await visibleQuestionFilter()), question: match }, { question: 1, bookId: 1 })
      .limit(PER_KIND)
      .lean<{ _id: Id; question: string; bookId: Id }[]>(),
    GraphNode.find({ ...(await visibleNodeFilter()), title: match }, { title: 1, slug: 1, graphId: 1 })
      .limit(PER_KIND)
      .lean<{ _id: Id; title: string; slug: string; graphId: Id }[]>(),
    Note.find({ ...(await visibleNoteFilter()), title: match }, { title: 1, slug: 1, seriesId: 1 })
      .limit(PER_KIND)
      .lean<{ _id: Id; title: string; slug: string; seriesId: Id }[]>(),
  ]);

  const [books, graphs, series] = await Promise.all([
    parents<Parent>(QuestionBook, questions.map((q) => q.bookId)),
    parents<Parent>(Graph, nodes.map((n) => n.graphId)),
    parents<Parent>(NoteSeries, notes.map((n) => n.seriesId)),
  ]);

  // A hit whose parent has gone missing is dropped rather than linked to a dead route.
  const hits: SearchHit[] = [
    ...questions.flatMap<SearchHit>((q) => {
      const book = books.get(String(q.bookId));
      return book
        ? [{ kind: "question", title: plain(q.question), context: book.title, href: `/interview/${book.slug}/${String(q._id)}` }]
        : [];
    }),
    ...nodes.flatMap<SearchHit>((n) => {
      const graph = graphs.get(String(n.graphId));
      return graph
        ? [
            {
              kind: "topic",
              title: n.title,
              context: graph.title,
              href: `/graphs/${graph.slug}?topic=${encodeURIComponent(n.slug)}`,
            },
          ]
        : [];
    }),
    ...notes.flatMap<SearchHit>((n) => {
      const parent = series.get(String(n.seriesId));
      return parent
        ? [{ kind: "chapter", title: n.title, context: parent.title, href: `/notes/${parent.slug}/${n.slug}` }]
        : [];
    }),
  ];

  // A title that starts with the term is what the user most likely meant.
  const starts = (hit: SearchHit) => (hit.title.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b));
}
