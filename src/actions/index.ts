import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { Speeches, SpeechVersions, and, db, eq } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedSpeech(speechId: string, userId: string) {
  const [speech] = await db
    .select()
    .from(Speeches)
    .where(and(eq(Speeches.id, speechId), eq(Speeches.userId, userId)));

  if (!speech) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Speech not found.",
    });
  }

  return speech;
}

async function getOwnedSpeechVersion(versionId: string, speechId: string, userId: string) {
  await getOwnedSpeech(speechId, userId);

  const [version] = await db
    .select()
    .from(SpeechVersions)
    .where(and(eq(SpeechVersions.id, versionId), eq(SpeechVersions.speechId, speechId)));

  if (!version) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Speech version not found.",
    });
  }

  return version;
}

export const server = {
  createSpeech: defineAction({
    input: z.object({
      title: z.string().min(1),
      occasion: z.string().optional(),
      audience: z.string().optional(),
      language: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [speech] = await db
        .insert(Speeches)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          occasion: input.occasion,
          audience: input.audience,
          language: input.language,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { speech } };
    },
  }),

  updateSpeech: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        occasion: z.string().optional(),
        audience: z.string().optional(),
        language: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.occasion !== undefined ||
          input.audience !== undefined ||
          input.language !== undefined ||
          input.notes !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSpeech(input.id, user.id);

      const [speech] = await db
        .update(Speeches)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.occasion !== undefined ? { occasion: input.occasion } : {}),
          ...(input.audience !== undefined ? { audience: input.audience } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Speeches.id, input.id))
        .returning();

      return { success: true, data: { speech } };
    },
  }),

  listSpeeches: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const speeches = await db
        .select()
        .from(Speeches)
        .where(eq(Speeches.userId, user.id));

      return { success: true, data: { items: speeches, total: speeches.length } };
    },
  }),

  createSpeechVersion: defineAction({
    input: z.object({
      speechId: z.string().min(1),
      versionLabel: z.string().optional(),
      tone: z.string().optional(),
      targetDurationMinutes: z.number().optional(),
      scriptText: z.string().min(1),
      isPreferred: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSpeech(input.speechId, user.id);

      const [version] = await db
        .insert(SpeechVersions)
        .values({
          id: crypto.randomUUID(),
          speechId: input.speechId,
          versionLabel: input.versionLabel,
          tone: input.tone,
          targetDurationMinutes: input.targetDurationMinutes,
          scriptText: input.scriptText,
          isPreferred: input.isPreferred ?? false,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { version } };
    },
  }),

  updateSpeechVersion: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        speechId: z.string().min(1),
        versionLabel: z.string().optional(),
        tone: z.string().optional(),
        targetDurationMinutes: z.number().optional(),
        scriptText: z.string().optional(),
        isPreferred: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.versionLabel !== undefined ||
          input.tone !== undefined ||
          input.targetDurationMinutes !== undefined ||
          input.scriptText !== undefined ||
          input.isPreferred !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSpeechVersion(input.id, input.speechId, user.id);

      const [version] = await db
        .update(SpeechVersions)
        .set({
          ...(input.versionLabel !== undefined ? { versionLabel: input.versionLabel } : {}),
          ...(input.tone !== undefined ? { tone: input.tone } : {}),
          ...(input.targetDurationMinutes !== undefined
            ? { targetDurationMinutes: input.targetDurationMinutes }
            : {}),
          ...(input.scriptText !== undefined ? { scriptText: input.scriptText } : {}),
          ...(input.isPreferred !== undefined ? { isPreferred: input.isPreferred } : {}),
        })
        .where(eq(SpeechVersions.id, input.id))
        .returning();

      return { success: true, data: { version } };
    },
  }),

  deleteSpeechVersion: defineAction({
    input: z.object({
      id: z.string().min(1),
      speechId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSpeechVersion(input.id, input.speechId, user.id);

      const result = await db.delete(SpeechVersions).where(eq(SpeechVersions.id, input.id));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Speech version not found.",
        });
      }

      return { success: true };
    },
  }),

  listSpeechVersions: defineAction({
    input: z.object({
      speechId: z.string().min(1),
      preferredOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSpeech(input.speechId, user.id);

      const versions = await db
        .select()
        .from(SpeechVersions)
        .where(
          input.preferredOnly
            ? and(
                eq(SpeechVersions.speechId, input.speechId),
                eq(SpeechVersions.isPreferred, true)
              )
            : eq(SpeechVersions.speechId, input.speechId)
        );

      return { success: true, data: { items: versions, total: versions.length } };
    },
  }),
};
