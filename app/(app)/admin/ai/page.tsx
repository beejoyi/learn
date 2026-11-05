import { AiKeyForm } from "@/components/admin/AiKeyForm";
import { AiSettingsForm } from "@/components/admin/AiSettingsForm";
import { getAiConfig } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { listCatalog } from "@/lib/openrouter";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI coach · Admin",
  description: "Choose the OpenRouter models behind the AI quiz coach.",
  path: "/admin/ai",
});

export default async function AiSettingsPage() {
  await connectDb();
  const { settings, apiKey } = await getAiConfig();
  const catalog = await listCatalog({ apiKey });
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
      <AiKeyForm
        source={settings.keySource}
        hint={settings.keyHint}
        updatedAt={settings.keyUpdatedAt ? formatDateTime(settings.keyUpdatedAt) : undefined}
        unreadable={settings.keyUnreadable}
      />
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
