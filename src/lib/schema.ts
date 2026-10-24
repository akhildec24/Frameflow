import { z } from 'zod';

export const uuidSchema = z.string().min(1);

export const cropPanSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  pan: cropPanSchema.optional(),
  zoom: z.number().optional(),
  fit: z.enum(['contain', 'cover', 'free']),
});

export const textStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.number(),
  colour: z.string(),
  align: z.enum(['left', 'centre', 'right']),
  lineHeight: z.number(),
  letterSpacing: z.number(),
  background: z.string().optional(),
});

export const elementBaseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  transform: transformSchema,
  startMs: z.number(),
  durationMs: z.number(),
  zIndex: z.number(),
  opacity: z.number(),
  locked: z.boolean(),
  hidden: z.boolean(),
});

export const captionConfigSchema = z.object({
  show: z.boolean(),
  position: z.enum(['top', 'bottom']),
  style: z.enum(['bar', 'pill']),
  text: z.string().optional(),
});

export const mediaElementSchema = elementBaseSchema.extend({
  kind: z.literal('media'),
  assetId: uuidSchema,
  trimStartMs: z.number(),
  muted: z.boolean(),
  volume: z.number(),
  caption: captionConfigSchema.optional(),
});

export const textElementSchema = elementBaseSchema.extend({
  kind: z.literal('text'),
  content: z.string(),
  style: textStyleSchema,
});

export const elementSchema = z.discriminatedUnion('kind', [mediaElementSchema, textElementSchema]);

export const sceneTransitionSchema = z.object({
  type: z.enum(['cut', 'crossfade', 'slide', 'zoom']),
  durationMs: z.number(),
});

export const sceneSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  durationMs: z.number(),
  background: z.string(),
  elements: z.array(elementSchema),
  transitionOut: sceneTransitionSchema.optional(),
  advance: z.enum(['manual', 'timed']),
});

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: z.enum(['image', 'video', 'audio']),
  mimeType: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationMs: z.number().optional(),
  sizeBytes: z.number(),
  storageKey: z.string(),
  thumbnailDataUrl: z.string().optional(),
  caption: z.string().optional(),
  hash: z.string().optional(),
  createdAt: z.string(),
  status: z.enum(['ready', 'processing', 'error']),
  errorMessage: z.string().optional(),
});

export const projectSchema = z.object({
  id: uuidSchema,
  schemaVersion: z.number(),
  name: z.string(),
  mode: z.enum(['video', 'slideshow', 'presentation']),
  width: z.number(),
  height: z.number(),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30)]),
  scenes: z.array(sceneSchema),
  assets: z.record(z.string(), mediaAssetSchema),
  activeSceneId: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectJson = z.infer<typeof projectSchema>;
