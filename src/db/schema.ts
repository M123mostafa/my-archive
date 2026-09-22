import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(),
  week: integer("week").notNull(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const lessonFiles = pgTable("lesson_files", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  lastModified: integer("last_modified"),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export type LessonSelect = typeof lessons.$inferSelect;
export type LessonInsert = typeof lessons.$inferInsert;
export type LessonFileSelect = typeof lessonFiles.$inferSelect;
export type LessonFileInsert = typeof lessonFiles.$inferInsert;
