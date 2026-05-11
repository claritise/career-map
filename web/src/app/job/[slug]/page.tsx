import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Constellation } from "~/components/constellation";
import { JobPanelClient } from "~/components/job-panel-client";
import {
  getAllSlugs,
  getAtlas,
  getDetails,
  getNeighbourSlugsBySlug,
  getNeighbours,
} from "~/lib/data";

/**
 * Full-page route for `/job/[slug]`. Reached on:
 *   1. Direct visit (typed URL, share link, refresh of an intercepted panel)
 *   2. Search engine indexing
 *
 * Client-side navigation from `/` goes through the intercepted parallel route
 * at app/@panel/(.)job/[slug] and the user stays on `/` with the panel overlaid.
 *
 * Renders the same constellation as `/` and overlays the panel — visually
 * identical to the intercepted variant, but the URL is canonical.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const details = await getDetails(slug);
    return {
      title: `${details.title} — Career Map`,
      description: details.description.slice(0, 160),
    };
  } catch {
    return { title: "Career Map" };
  }
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let atlas, neighbourSlugsBySlug, details, neighbours;
  try {
    [atlas, neighbourSlugsBySlug, details, neighbours] = await Promise.all([
      getAtlas(),
      getNeighbourSlugsBySlug(),
      getDetails(slug),
      getNeighbours(slug),
    ]);
  } catch {
    notFound();
  }
  return (
    <main className="h-screen w-screen overflow-hidden">
      <Constellation
        atlas={atlas}
        neighbourSlugsBySlug={neighbourSlugsBySlug}
      />
      <JobPanelClient details={details} neighbours={neighbours} />
    </main>
  );
}
