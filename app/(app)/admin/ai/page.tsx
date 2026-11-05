import { AiSettingsForm } from "@/components/admin/AiSettingsForm";
import { getAiSettings } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { listCatalog } from "@/lib/openrouter";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI coach · Admin",
  description: "Choose the OpenRouter models behind the AI quiz coach.",
  path: "/admin/ai",
});

export default async function AiSettingsPage() {
  await connectDb();
  const [settings, catalog] = await Promise.all([getAiSettings(), listCatalog()]);
  return (
    <section className="grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold">AI coach</h1>
      <p className="text-sm text-muted-foreground">
        The quiz coach grades typed answers and answers follow-up questions through{" "}
        <a href="https://openrouter.ai/models" className="underline" target="_blank" rel="noreferrer">
          OpenRouter
        </a>
        . Free models cost nothing but are rate-limited and come and go, so pick a backup: it is used
        whenever the primary model fails, is busy, or gives a reply the coach cannot read.
      </p>
      {!settings.keyConfigured && (
        <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <strong>No OpenRouter key.</strong> Set <code>OPENROUTER_API_KEY</code> in the environment (a free key from{" "}
          <a href="https://openrouter.ai/keys" className="underline" target="_blank" rel="noreferrer">
            openrouter.ai/keys
          </a>{" "}
          works with free models). Until then the coach stays off whatever you choose here.
        </p>
      )}
      <AiSettingsForm
        initial={{
          enabled: settings.enabled,
          primaryModel: settings.primaryModel,
          fallbackModel: settings.fallbackModel,
          dailyLimit: settings.dailyLimit,
        }}
        keyConfigured={settings.keyConfigured}
        catalog={catalog.models}
        catalogError={catalog.error}
      />
    </section>
  );
}
