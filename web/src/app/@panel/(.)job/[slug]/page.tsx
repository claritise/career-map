import { notFound } from "next/navigation";
import { JobPanelClient } from "~/components/job-panel-client";
import { getAllSlugs, getDetails, getNeighbours } from "~/lib/data";

/**
 * Intercepted panel route. When the user clicks a bubble at `/`, Next renders
 * THIS slot instead of full-navigating to `/job/[slug]`. On refresh / direct
 * visit, the non-intercepted `app/job/[slug]/page.tsx` is shown instead.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function PanelInterceptedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let details, neighbours;
  try {
    [details, neighbours] = await Promise.all([
      getDetails(slug),
      getNeighbours(slug),
    ]);
  } catch {
    notFound();
  }
  return <JobPanelClient details={details} neighbours={neighbours} />;
}
