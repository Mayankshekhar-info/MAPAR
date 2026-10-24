import { z } from "zod";
import { HierarchyLevel } from "../types/organization.types";

export const createNodeSchema = z.object({
  level: z.custom<HierarchyLevel>(),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name cannot exceed 150 characters")
    .trim(),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(50, "Code cannot exceed 50 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase letters, numbers, hyphens, and underscores")
    .trim(),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
  parent_id: z.number().nullable().optional(),
});

export type CreateNodeFormValues = z.infer<typeof createNodeSchema>;



export const updateNodeSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name cannot exceed 150 characters")
    .trim(),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(50, "Code cannot exceed 50 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase letters, numbers, hyphens, and underscores")
    .trim(),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  parent_id: z.number().nullable().optional(),
});

export type UpdateNodeFormValues = {
  name: string;
  code: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  parent_id?: number | null;
};
