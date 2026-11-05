// Client-safe: the art-direction request and answer shapes, with no provider import, so the browser can validate
// the server's answer again. Server orchestration lives in ./direction.ts.
import { z } from "zod";
import { BriefSchema, COLOUR_ROLES } from "../design/direction";
import { FontRefSchema, HexSchema } from "../design/schema";

export const AllowedSchema = z.object({
  fontIds: z.array(FontRefSchema).min(1).max(200),
  templateIds: z.array(z.string().regex(/^tpl_[\w-]{1,60}$/)).min(1).max(100),
  imageIds: z.array(z.string().regex(/^res_[\w-]{1,80}$/)).max(200),
});
export type Allowed = z.infer<typeof AllowedSchema>;
export const DirectionInputSchema = z.object({ brief: BriefSchema, allowed: AllowedSchema });
export type DirectionInput = z.infer<typeof DirectionInputSchema>;
export const DirectionAnswerSchema = z.object({
  palette: z.array(z.object({ hex: HexSchema, role: z.enum(COLOUR_ROLES) })).min(2).max(6),
  fonts: z.object({ display: FontRefSchema, text: FontRefSchema }),
  concepts: z.array(z.object({
    templateId: z.string().max(80),
    photoOrder: z.array(z.string().max(84)).max(200),
    emphasis: z.enum(["title", "photo", "type"]),
    note: z.string().max(240),
  })).length(3),
  notes: z.string().max(600),
});
export type DirectionAnswer = z.infer<typeof DirectionAnswerSchema>;
