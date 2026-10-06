import { headers } from "next/headers";
import { Search, SlidersHorizontal } from "lucide-react";
import { auth } from "@/lib/auth";
import { discover } from "@/services/recommendations";
import { CreatorCard } from "@/components/creator-card";
import { EmptyState } from "@/components/ui";
import { Footer } from "@/components/shell";
export const metadata = { title: "Discover creators" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams,
    session = await auth.api.getSession({ headers: await headers() });
  const creators = await discover({
    search: q.search,
    category: q.category,
    language: q.language,
    sort: q.sort,
    userId: session?.user.id,
  });
  return (
    <>
      <main className="directory page-container">
        <div className="eyebrow">FOLLOW YOUR CURIOSITY</div>
        <h1>
          Find your <em>kind of extraordinary.</em>
        </h1>
        <p className="page-intro">
          Original personalities. Private worlds. A connection for every side of
          you.
        </p>
        <form className="discovery-filters" action="/explore">
          <label className="search-box">
            <Search size={18} />
            <input
              name="search"
              aria-label="Search creators"
              defaultValue={q.search}
              placeholder="Search names, interests, personalities…"
            />
          </label>
          <label className="sr-only" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue={q.category || ""}>
            <option value="">All personalities</option>
            {[
              "Lifestyle",
              "Gaming",
              "Wellness",
              "Alternative",
              "Fashion",
              "Travel",
              "Everyday",
              "Fantasy",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="language">
            Language
          </label>
          <select id="language" name="language" defaultValue={q.language || ""}>
            <option value="">All languages</option>
            {[
              "English",
              "Spanish",
              "French",
              "Japanese",
              "German",
              "Italian",
              "Korean",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="sort">
            Sort creators
          </label>
          <select id="sort" name="sort" defaultValue={q.sort || "trending"}>
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="price">Price: low to high</option>
          </select>
          <button className="button secondary" type="submit">
            <SlidersHorizontal size={16} />
            Apply
          </button>
        </form>
        <div className="results-label">
          <span>{creators.length} extraordinary personalities</span>
          <span>FICTIONAL AI · ADULT 21+</span>
        </div>
        {creators.length ? (
          <div className="creator-grid">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="A new discovery awaits."
            body="Try another interest or broaden your filters."
          />
        )}
      </main>
      <Footer />
    </>
  );
}
