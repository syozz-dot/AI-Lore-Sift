import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { DistillSubmitForm } from "../../components/distill-submit-form";
import { LocalDistillResult } from "../../components/local-distill-result";
import { DistillTaskList } from "../../components/distill-task-list";
import { getDistillSession } from "../../lib/distill-auth";
import { getGuestUsage, GUEST_FOLLOW_UP_LIMIT } from "../../lib/distill-guest";
import {
  getGuestProtectionError,
  isGuestChallengeRequired,
} from "../../lib/distill-guest-protection";
import { listDistillDocuments } from "../../lib/distill";
import { normalizePrivateSearchQuery } from "../../lib/distill-search";
import { isTurnstileConfigured } from "../../lib/turnstile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "脱水工作台",
  description: "把网页与长文变成有来源、有证据、可沉淀的结构化知识。",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function DistillPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; local?: string }>;
}) {
  const session = await getDistillSession();
  const params = await searchParams;
  if (!session && params.local) {
    const usage = await getGuestUsage();
    return (
      <LocalDistillResult
        documentId={params.local.slice(0, 128)}
        followUpsRemaining={Math.max(
          0,
          GUEST_FOLLOW_UP_LIMIT - (usage?.followUps ?? GUEST_FOLLOW_UP_LIMIT),
        )}
      />
    );
  }
  const query = normalizePrivateSearchQuery(params.q);
  const documents =
    session && process.env.DATABASE_URL
      ? await listDistillDocuments(session.ownerId, query ? 60 : 18, query)
      : [];
  const showTaskRail = Boolean(session && (documents.length || query));
  const guestUsage = session ? null : await getGuestUsage();
  const turnstileSiteKey = isTurnstileConfigured()
    ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""
    : "";
  const guestProtectionError = session ? null : getGuestProtectionError();

  return (
    <main
      className={`distillAgentWorkspace${session ? "" : " isGuest"}${showTaskRail ? "" : " withoutTaskRail"}`}
    >
      {showTaskRail ? (
        <DistillTaskList documents={documents} searchQuery={query} />
      ) : null}
      <div className="distillAgentCanvas distillNewTaskCanvas">
        <header className="distillConversationHeader">
          <div>
            <p>新建任务</p>
            <h1 id="distill-title">脱水助手</h1>
          </div>
          <span>
            <LockSimple aria-hidden="true" size={14} />
            {session ? (
              "仅你可见"
            ) : (
              <Link href="/distill/access?next=/distill">站点所有者入口</Link>
            )}
          </span>
        </header>
        <DistillSubmitForm
          mode={session ? "owner" : "guest"}
          guestUsed={Boolean(guestUsage)}
          turnstileSiteKey={turnstileSiteKey}
          turnstileRequired={isGuestChallengeRequired()}
          guestProtectionError={guestProtectionError}
        />
      </div>
    </main>
  );
}
