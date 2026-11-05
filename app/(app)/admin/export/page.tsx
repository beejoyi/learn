import { AdminCard, AdminPage } from "@/components/admin/layout";
import { buttonVariants } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Export · Admin",
  description: "Download every content collection as a backup.",
  path: "/admin/export",
});

export default function ExportPage() {
  return (
    <AdminPage
      title="Export content"
      width="narrow"
      description="Downloads every book, question, graph, topic, note series, chapter and subject as one JSON file. Users, progress and edit history are not included."
    >
      <AdminCard>
        {/* A plain link: the route streams a file download, which client-side navigation would not handle. */}
        <a href="/api/admin/export" className={buttonVariants({ className: "justify-self-start" })} download>
          Download content export
        </a>
        <p className="text-sm text-muted-foreground">
          For a full backup that also keeps users, progress, history and settings, run{" "}
          <code>npm run backup -- &lt;file&gt;</code> from the <code>web/</code> folder.
        </p>
      </AdminCard>
    </AdminPage>
  );
}
