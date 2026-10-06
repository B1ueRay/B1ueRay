import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: process.env.DEMO_MODE !== "true",
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail } = await import("@/providers/email");
      await sendEmail(user.email, "Reset your VELORA password", url);
    },
  },
  emailVerification: {
    sendOnSignUp: process.env.DEMO_MODE !== "true",
    sendVerificationEmail: async ({ user, url }) => {
      const { sendEmail } = await import("@/providers/email");
      await sendEmail(user.email, "Verify your VELORA email", url);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.userSettings.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
          });
          await db.ageVerificationStatus.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
          });
          await db.userProfile.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
          });
          await db.analyticsEvent.create({
            data: { userId: user.id, name: "signup_completed" },
          });
        },
      },
    },
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "USER", input: false },
      status: { type: "string", defaultValue: "ACTIVE", input: false },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 30, storage: "memory" },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
    useSecureCookies:
      process.env.NODE_ENV === "production" &&
      process.env.BETTER_AUTH_URL?.startsWith("https://") === true,
  },
});
