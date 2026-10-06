import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { money } from "@/lib/brand";
import { AIBadge } from "./ui";
import { FavoriteButton } from "./commerce";
export type CreatorCardData = {
  id: string;
  slug: string;
  name: string;
  age: number;
  bio: string;
  avatar: string;
  category: string;
  tags: string[];
  plans: { price: number }[];
  favorited?: boolean;
};
export function CreatorCard({
  creator,
  number,
}: {
  creator: CreatorCardData;
  number?: number;
}) {
  return (
    <article className="creator-card">
      <div className="creator-photo">
        <Link
          href={`/creators/${creator.slug}`}
          aria-label={`Meet ${creator.name}`}
        >
          <img
            src={creator.avatar}
            alt={`${creator.name}, fictional AI adult age ${creator.age}`}
            loading="lazy"
          />
        </Link>
        <span className="card-category">{creator.category}</span>
        <FavoriteButton creatorId={creator.id} initial={creator.favorited} />
        <div className="card-image-bottom">
          <AIBadge />
          <span className="age-label">{creator.age} · 21+</span>
        </div>
      </div>
      <div className="creator-card-body">
        <div className="creator-name-row">
          <Link href={`/creators/${creator.slug}`}>
            <h3>{creator.name}</h3>
          </Link>
          <Link
            href={`/creators/${creator.slug}`}
            className="card-arrow"
            aria-label={`View ${creator.name}`}
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <p>{creator.bio}</p>
        <div className="card-meta">
          <span>
            {creator.tags
              .slice(0, 2)
              .map((t) => t[0].toUpperCase() + t.slice(1))
              .join(" · ")}
          </span>
          <span>
            <strong>{money(creator.plans[0]?.price || 0)}</strong> / mo
          </span>
        </div>
      </div>
      {number !== undefined && (
        <span className="card-number">0{number + 1}</span>
      )}
    </article>
  );
}
