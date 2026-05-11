"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { JobPanel } from "~/components/job-panel";
import { useEscapeKey } from "~/lib/use-escape-key";
import type { Details, Neighbour } from "~/lib/types";

export type JobPanelClientProps = {
  details: Details;
  neighbours: Neighbour[];
};

/**
 * Wraps JobPanel with router-driven onSelect/onClose. Lives in its own file
 * so the panel's render logic can stay decoupled from Next routing and remain
 * trivially testable.
 */
export function JobPanelClient({ details, neighbours }: JobPanelClientProps) {
  const router = useRouter();

  const onSelect = useCallback(
    (slug: string) => router.push(`/job/${slug}`, { scroll: false }),
    [router],
  );

  const onClose = useCallback(
    () => router.push("/", { scroll: false }),
    [router],
  );

  useEscapeKey(onClose);

  return (
    <JobPanel
      details={details}
      neighbours={neighbours}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
