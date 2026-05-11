import { Constellation } from "~/components/constellation";
import { getAtlas, getNeighbourSlugsBySlug } from "~/lib/data";

export default async function HomePage() {
  const [atlas, neighbourSlugsBySlug] = await Promise.all([
    getAtlas(),
    getNeighbourSlugsBySlug(),
  ]);
  return (
    <main className="h-screen w-screen overflow-hidden">
      <Constellation
        atlas={atlas}
        neighbourSlugsBySlug={neighbourSlugsBySlug}
      />
    </main>
  );
}
