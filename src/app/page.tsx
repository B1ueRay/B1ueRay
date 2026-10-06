import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  LockKeyhole,
  Check,
} from "lucide-react";
import { discover } from "@/services/recommendations";
import { CreatorCard } from "@/components/creator-card";
import { Footer } from "@/components/shell";
export default async function Home() {
  const creators = await discover();
  return (
    <>
      <main className="landing">
        <section className="hero">
          <div className="hero-orbit" />
          <div className="hero-content">
            <div className="eyebrow">
              <span className="live-dot" /> PREMIUM AI VIRTUAL CREATORS
            </div>
            <h1>
              Not ordinary.
              <br />
              Not expected.
              <br />
              <em>Entirely yours.</em>
            </h1>
            <p>
              A new kind of connection. Discover extraordinary AI creators,
              exclusive moments, and conversations that go a little deeper.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/explore">
                Find your connection <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" href="#how-it-works">
                Step inside <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-proof">
              <div className="mini-avatars">
                {creators.slice(0, 3).map((c) => (
                  <img key={c.id} src={c.avatar} alt="Fictional AI creator" />
                ))}
              </div>
              <div>
                <strong>A world of personalities</strong>
                <span>Original characters. Limitless inspiration.</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-label">
              THE ART OF CONNECTION <span>01 / 08</span>
            </div>
            <div className="hero-portrait">
              <img
                src="/media/isadora-sol.svg"
                alt="Original fictional adult AI portrait of Isadora Sol, age 27"
              />
              <div className="portrait-vignette" />
              <div className="hero-person">
                <div className="eyebrow">FICTIONAL AI CREATOR · 27</div>
                <h2>
                  Isadora Sol <Sparkles size={19} />
                </h2>
                <p>Some connections are worth imagining.</p>
                <Link
                  href="/creators/isadora-sol"
                  aria-label="Meet Isadora Sol"
                >
                  <ArrowUpRight size={24} />
                </Link>
              </div>
            </div>
            <div className="floating-card">
              <div className="float-icon">
                <MessageCircle size={19} />
              </div>
              <div>
                <strong>A private world. A real spark.</strong>
                <p>Always AI. Always disclosed.</p>
              </div>
              <span>✦</span>
            </div>
            <span className="hero-vertical">CREATED FOR THE CURIOUS</span>
          </div>
        </section>
        <div className="trust-strip">
          <span>
            <ShieldCheck size={16} /> Privacy comes first
          </span>
          <span>
            <Sparkles size={16} /> Clearly labeled AI creators
          </span>
          <span>
            <LockKeyhole size={16} /> Exclusive, protected content
          </span>
          <span>
            <Check size={16} /> Fictional adults, 21+
          </span>
        </div>
        <section className="section featured">
          <div className="section-heading">
            <div>
              <div className="eyebrow">EXCEPTIONAL BY DESIGN</div>
              <h2>
                Meet your next <em>fascination.</em>
              </h2>
              <p>
                Different worlds. Distinct personalities. Which one is yours?
              </p>
            </div>
            <Link className="text-link" href="/explore">
              Explore all creators <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="category-pills">
            <Link className="selected" href="/explore">
              Curated for you
            </Link>
            {["Lifestyle", "Gaming", "Wellness", "Fashion", "Travel"].map(
              (c) => (
                <Link key={c} href={`/explore?category=${c}`}>
                  {c}
                </Link>
              ),
            )}
          </div>
          <div className="creator-grid">
            {creators.slice(0, 4).map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </section>
        <section id="how-it-works" className="section experience">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A DIFFERENT KIND OF CLOSE</div>
              <h2>
                Connection, <em>on your terms.</em>
              </h2>
            </div>
            <p>Your curiosity is the only invitation you need.</p>
          </div>
          <div className="experience-grid">
            {[
              [
                CompassIcon,
                "01",
                "Discover your kind of extraordinary",
                "Explore original personalities, interests, and creative worlds. Find a connection that feels like you.",
              ],
              [
                LockKeyhole,
                "02",
                "Step into the inner circle",
                "Join for exclusive posts and private digital art. Unlock selected moments whenever inspiration strikes.",
              ],
              [
                MessageCircle,
                "03",
                "Make the conversation yours",
                "Talk with a clearly disclosed AI persona. Enjoy private, imaginative conversations — at your own pace.",
              ],
            ].map(([Icon, n, title, text]) => {
              const I = Icon as typeof MessageCircle;
              return (
                <div className="experience-card" key={String(n)}>
                  <div className="step-head">
                    <I size={25} />
                    <span>{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">MORE WORLDS TO EXPLORE</div>
              <h2>
                Beyond your <em>usual.</em>
              </h2>
            </div>
            <Link href="/explore?sort=newest" className="text-link">
              Find something new <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="creator-grid">
            {creators.slice(4).map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </section>
        <section className="privacy-banner">
          <div className="privacy-emblem">
            <ShieldCheck size={36} />
          </div>
          <div>
            <div className="eyebrow">IMAGINATION, WITH INTEGRITY</div>
            <h2>
              Private by nature.
              <br />
              <em>Transparent by choice.</em>
            </h2>
            <p>
              Every creator is a fictional adult. Every AI conversation is
              disclosed. Your privacy, boundaries, and peace of mind are part of
              the experience.
            </p>
            <Link href="/legal/ai-disclosure" className="text-link">
              Our commitment to you <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="privacy-word">V</div>
        </section>
        <section className="cta-section">
          <div className="eyebrow">YOUR WORLD IS WAITING</div>
          <h2>
            A little curiosity.
            <br />
            <em>An entirely new connection.</em>
          </h2>
          <Link href="/signup" className="button">
            Enter your world <ArrowUpRight size={18} />
          </Link>
          <p>18+ only · Fictional AI creators · Safe demo</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
function CompassIcon({ size = 24 }: { size?: number }) {
  return <Sparkles size={size} />;
}
