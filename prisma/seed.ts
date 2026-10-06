import { db } from "../src/lib/db";
import { auth } from "../src/lib/auth";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Role } from "@prisma/client";
const id = (key: string) => {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const people = [
  [
    "isadora-sol",
    "Isadora Sol",
    27,
    "Lifestyle",
    "Spanish,English",
    "Slow mornings. Mediterranean light. A little everyday magic.",
    "warm, thoughtful",
    "design,coffee,coastal living",
    "#b69573",
    1499,
  ],
  [
    "nova-arcade",
    "Nova Arcade",
    25,
    "Gaming",
    "English,Japanese",
    "Late-night quests and good company. Your next adventure starts here.",
    "playful, witty",
    "gaming,technology,sci-fi",
    "#958ab8",
    1299,
  ],
  [
    "aria-wells",
    "Aria Wells",
    28,
    "Wellness",
    "English,French",
    "Mindful movement, a clearer mind, and room to breathe.",
    "calm, encouraging",
    "fitness,yoga,nature",
    "#829882",
    1699,
  ],
  [
    "raven-noir",
    "Raven Noir",
    26,
    "Alternative",
    "English,German",
    "Between vinyl records and midnight poetry. Curiosity looks good on you.",
    "clever, poetic",
    "music,poetry,art",
    "#a48089",
    1499,
  ],
  [
    "celine-vale",
    "Celine Vale",
    30,
    "Fashion",
    "French,English",
    "A considered wardrobe. An unconventional eye. Stories behind the style.",
    "elegant, perceptive",
    "fashion,architecture,photography",
    "#ae956f",
    1999,
  ],
  [
    "sienna-roam",
    "Sienna Roam",
    29,
    "Travel",
    "English,Italian",
    "Postcards from imagined places. Collecting moments, never destinations.",
    "adventurous, bright",
    "travel,food,landscapes",
    "#809f9e",
    1599,
  ],
  [
    "emilia-bloom",
    "Emilia Bloom",
    24,
    "Everyday",
    "English,Spanish",
    "A cozy corner of the internet. Books, baking, and honest little conversations.",
    "friendly, curious",
    "books,baking,gardening",
    "#b69b95",
    1499,
  ],
  [
    "lyra-cosmos",
    "Lyra Cosmos",
    25,
    "Fantasy",
    "English,Korean",
    "Costume sketches and worlds yet to be imagined. A creative escape awaits.",
    "imaginative, upbeat",
    "costumes,illustration,worldbuilding",
    "#8c91b5",
    1799,
  ],
] as const;
function portrait(accent: string, index: number) {
  const hair = [
    "#29221f",
    "#222335",
    "#4b3626",
    "#201f26",
    "#3b2b28",
    "#633a2b",
    "#4b3025",
    "#262d43",
  ][index];
  const skin = [
    "#c19476",
    "#caa28c",
    "#a6795d",
    "#d7b39d",
    "#b3866f",
    "#b08365",
    "#d2a690",
    "#d0a790",
  ][index];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="920" viewBox="0 0 720 920"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="#1d1c24"/></linearGradient><radialGradient id="glow"><stop stop-color="#fbead6" stop-opacity=".28"/><stop offset="1" stop-color="#fbead6" stop-opacity="0"/></radialGradient><linearGradient id="dress" x2="1" y2="1"><stop stop-color="#28252b"/><stop offset="1" stop-color="#0c0d13"/></linearGradient></defs><rect width="720" height="920" fill="url(#bg)"/><circle cx="560" cy="230" r="340" fill="url(#glow)"/><path d="M0 650L720 420V920H0" fill="#080b12" opacity=".17"/><path d="M90 0V920M620 0V920" stroke="#fff" opacity=".06"/><ellipse cx="360" cy="905" rx="300" ry="80" fill="#000" opacity=".2"/><path d="M211 430Q175 230 266 169Q360 95 462 190Q529 280 503 523L474 688H222Z" fill="${hair}"/><path d="M168 920L190 679Q205 591 302 566L419 566Q517 591 535 679L568 920Z" fill="url(#dress)"/><path d="M302 497L301 572Q357 647 420 572L411 491" fill="${skin}"/><ellipse cx="359" cy="356" rx="111" ry="156" fill="${skin}"/><path d="M246 332Q215 190 332 176Q437 149 476 286Q394 247 345 200Q305 271 246 332Z" fill="${hair}"/><path d="M274 351Q300 338 322 349M384 349Q411 338 435 351" stroke="#513b32" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="300" cy="361" rx="8" ry="6" fill="#302824"/><ellipse cx="410" cy="361" rx="8" ry="6" fill="#302824"/><path d="M358 365L349 407Q361 416 373 408" fill="none" stroke="#9a6e56" stroke-width="3"/><path d="M325 439Q358 450 392 437Q362 470 325 439" fill="#8b5550"/><path d="M242 664Q360 734 477 660" fill="none" stroke="${accent}" stroke-width="2"/><path d="M315 591Q357 654 400 591" fill="none" stroke="#cfb790" stroke-width="3"/><circle cx="357" cy="645" r="6" fill="#cfb790"/><circle cx="251" cy="408" r="6" fill="#cfb790"/><circle cx="468" cy="408" r="6" fill="#cfb790"/><text x="36" y="872" fill="#fff" opacity=".5" font-family="sans-serif" font-size="11" letter-spacing="4">FICTIONAL AI · ADULT ${people[index][2]}</text></svg>`;
}
async function main() {
  await mkdir("public/media", { recursive: true });
  await mkdir(".storage/seed", { recursive: true });
  for (const [i, p] of people.entries()) {
    const [
      slug,
      name,
      age,
      category,
      langs,
      bio,
      personality,
      interests,
      accent,
      price,
    ] = p;
    const creatorId = id(slug),
      svg = portrait(accent, i);
    await writeFile(`public/media/${slug}.svg`, svg);
    const c = await db.creator.upsert({
      where: { slug },
      create: {
        id: creatorId,
        slug,
        name,
        age,
        category,
        languages: langs.split(","),
        tags: interests.split(","),
        bio,
        avatar: `/media/${slug}.svg`,
        cover: `/media/${slug}.svg`,
        accent,
        featured: i < 3,
        popularity: 95 - i * 7,
      },
      update: {},
    });
    await db.creatorPersona.upsert({
      where: { creatorId: c.id },
      create: {
        creatorId: c.id,
        personality,
        communicationStyle:
          "Warm, respectful, concise. Disclose fictional AI identity.",
        background: `${name} is a fictional adult virtual character, aged ${age}. No real person is represented.`,
        interests: interests.split(","),
        tone: personality,
        languages: langs.split(","),
        relationshipConfig: { level: "friendly", noDependency: true },
        memoryConfig: { shortTermMessages: 12, longTerm: "adapter-ready" },
        prohibitedTopics: [
          "minors",
          "real-person impersonation",
          "coercion",
          "illegal content",
        ],
        boundaries:
          "No explicit content in demo. No real-world promises. Respect privacy and consent.",
        monetizationConfig: {
          paidOfferEvery: 2,
          offerPreview: "A little inspiration, curated just for you.",
          offerBody: `A private ${category.toLowerCase()} note from ${name}: create a quiet moment, try something new, and tell me the story it inspires.`,
        },
      },
      update: {},
    });
    await db.creatorSettings.upsert({
      where: { creatorId: c.id },
      create: {
        creatorId: c.id,
        paidMessagePrice: 1299,
        requestStartingPrice: 2999,
      },
      update: {},
    });
    await db.subscriptionPlan.upsert({
      where: { id: id(`${slug}-plan`) },
      create: { id: id(`${slug}-plan`), creatorId: c.id, price },
      update: {},
    });
    for (const [j, visibility] of (
      ["PUBLIC", "SUBSCRIBER", "PPV"] as const
    ).entries()) {
      const mediaId = id(`${slug}-media-${j}`),
        postId = id(`${slug}-post-${j}`),
        key = `seed/${mediaId}.svg`;
      const art = svg.replace(
        "FICTIONAL AI · ADULT",
        "VELORA EDITORIAL · ADULT",
      );
      await writeFile(`.storage/${key}`, art);
      await db.creatorMedia.upsert({
        where: { id: mediaId },
        create: {
          id: mediaId,
          creatorId: c.id,
          storageKey: key,
          size: Buffer.byteLength(art),
          title: ["The introduction", "The private edit", "A moment to keep"][
            j
          ],
          tags: [category.toLowerCase()],
          moderation: "APPROVED",
        },
        update: {},
      });
      await db.creatorPost.upsert({
        where: { id: postId },
        create: {
          id: postId,
          creatorId: c.id,
          title: [
            "A world of my own",
            "The inner-circle edit",
            "Just between us",
          ][j],
          body: [
            `Welcome to my imagined world. I'm ${name}, a fictional AI creator. Here, ${interests.split(",")[0]} is always an invitation to connect.`,
            `A quieter, more personal chapter. Today’s creative study explores ${interests.split(",")[1]}. Thank you for being part of my inner circle.`,
            `An exclusive digital art study, made with care. This safe-for-work fictional portrait is yours to enjoy privately.`,
          ][j],
          visibility,
          price: visibility === "PPV" ? 999 : 0,
          moderation: "APPROVED",
          publishedAt: new Date(Date.now() - (i * 3 + j) * 3600000),
          media: { create: { mediaId } },
        },
        update: {},
      });
    }
  }
  const legal = [
    [
      "terms",
      "Terms of service",
      "VELORA is a development demonstration of a fictional AI creator platform for adults 18+. All represented creators are fictional adults aged 21 or older. Mock transactions have no monetary value and do not charge a card. Subscription periods are 30 days in this demo. Access may be revoked for policy violations. No provider, identity verification, or processor approval is implied. Production launch requires jurisdiction-specific legal review, age-assurance controls, approved providers, published refund terms and accurate operator/contact details.",
    ],
    [
      "privacy",
      "Privacy notice",
      "We store account details, sessions, purchases, conversations, optional conversation preferences, reports and audit records in the local database. Passwords are hashed by Better Auth. Optional analytics never includes chat text. Conversation deletion removes messages and memory. Account deletion requests are queued for staff review; financial and moderation records may require lawful retention. This demo sends no email or analytics to third parties. Production retention schedules, controller identity, legal basis and data-subject workflows must be finalized before launch.",
    ],
    [
      "ai-disclosure",
      "AI disclosure",
      "Every VELORA creator is a fictional adult virtual character, not a human. Portraits are original non-explicit vector illustrations. Conversations are simulated by a local mock language provider. The demo voice provider produces a neutral tone, not a human voice. AI can be inaccurate; do not rely on it for medical, financial or legal advice. There is no real-world relationship or promise of exclusivity.",
    ],
    [
      "content-policy",
      "Content policy",
      "Only fictional adult characters represented as 21+ are permitted. Minors and youthful representations, real-person impersonation without documented authorization, celebrity deepfakes, non-consensual intimate imagery, revenge porn, exploitation, coercion, trafficking, incest-related and illegal material are prohibited. Demo content must be non-explicit and safe for work. Generated material is held for staff review before use in posts. Report suspected violations from creator profiles or posts. Staff can hide/remove content and suspend/ban accounts; actions are audited. Real-person generation remains disabled.",
    ],
  ];
  for (const [slug, title, body] of legal)
    await db.legalDocument.upsert({
      where: { slug_version: { slug, version: "1.0" } },
      create: { slug, version: "1.0", title, body },
      update: {},
    });
  for (const [email, name, role] of [
    ["member@velora.test", "Alex Morgan", "USER"],
    ["admin@velora.test", "VELORA Admin", "ADMIN"],
    ["manager@velora.test", "Creator Studio", "CREATOR_MANAGER"],
    ["moderator@velora.test", "Trust & Safety", "MODERATOR"],
  ] as const) {
    if (process.env.DEMO_MODE !== "true") continue;
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      const result = await auth.api.signUpEmail({
        body: { name, email, password: "VeloraDemo!2026" },
      });
      user = await db.user.findUniqueOrThrow({ where: { id: result.user.id } });
    }
    await db.user.update({
      where: { id: user.id },
      data: { role: role as Role, emailVerified: true },
    });
    const ageStatus = await db.ageVerificationStatus.findUnique({
      where: { userId: user.id },
    });
    await db.ageVerificationStatus.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        state: "SELF_DECLARED",
        declaredAt: new Date(),
      },
      update:
        ageStatus?.state === "UNVERIFIED"
          ? { state: "SELF_DECLARED", declaredAt: new Date() }
          : {},
    });
    await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    const docs = await db.legalDocument.findMany({ where: { active: true } });
    for (const d of docs)
      await db.legalAcceptance.upsert({
        where: { userId_documentId: { userId: user.id, documentId: d.id } },
        create: { userId: user.id, documentId: d.id },
        update: {},
      });
  }
  await db.siteConfiguration.upsert({
    where: { key: "reportReasons" },
    create: {
      key: "reportReasons",
      value: [
        "Unsafe content",
        "Underage representation",
        "Impersonation",
        "Harassment",
        "Payment issue",
        "Other",
      ],
    },
    update: {},
  });
  await db.siteConfiguration.upsert({
    where: { key: "pricing" },
    create: {
      key: "pricing",
      value: { ppvMin: 499, ppvMax: 4999, messageMin: 299, messageMax: 3999 },
    },
    update: {},
  });
  console.log(
    "Seeded 8 fictional adult creators, 24 safe posts, legal documents and demo accounts.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
