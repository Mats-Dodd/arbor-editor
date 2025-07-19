import {
  boolean,
  integer,
  pgTable,
  timestamp,
  varchar,
  text,
  customType,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "@hono/zod-openapi"
export * from "./auth-schema"
import { users } from "./auth-schema"
import { index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const projectsTable = pgTable(`projects`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  shared_user_ids: text("shared_user_ids").array().notNull().default([]),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  owner_id: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const todosTable = pgTable(`todos`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  project_id: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  user_ids: text("user_ids").array().notNull().default([]),
})

export const foldersTable = pgTable(
  "folders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    project_id: integer()
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    parent_folder_id: integer(), // null for root folders
    name: text("name").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      uniqueFolder: uniqueIndex("folders_project_parent_name_unique").on(
        table.project_id,
        table.parent_folder_id,
        table.name
      ),
      idxParent: index("folders_parent_idx").on(table.parent_folder_id),
    }
  }
)

// Drizzle doesn't ship a built‑in bytea helper. We declare a minimal custom one
// so Node.loroSnapshot can stay a true PostgreSQL BYTEA column.
// Using Uint8Array for browser compatibility instead of Buffer
export const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea"
  },
})

export const filesTable = pgTable(
  "files",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    project_id: integer()
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    folder_id: integer().references(() => foldersTable.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    loro_snapshot: bytea(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      uniqueFile: uniqueIndex("files_folder_name_unique").on(
        table.folder_id,
        table.name
      ),
      idxFolder: index("files_folder_idx").on(table.folder_id),
    }
  }
)

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  folders: many(foldersTable),
  files: many(filesTable),
}))

export const foldersRelations = relations(foldersTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [foldersTable.project_id],
    references: [projectsTable.id],
  }),
  parent: one(foldersTable, {
    fields: [foldersTable.parent_folder_id],
    references: [foldersTable.id],
  }),
  children: many(foldersTable),
  files: many(filesTable),
}))

export const filesRelations = relations(filesTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [filesTable.project_id],
    references: [projectsTable.id],
  }),
  folder: one(foldersTable, {
    fields: [filesTable.folder_id],
    references: [foldersTable.id],
  }),
}))

// Schemas for projects
export const selectProjectSchema = createSelectSchema(projectsTable)
export const createProjectSchema = createInsertSchema(projectsTable)
  .omit({
    created_at: true,
  })
  .openapi(`CreateProject`)
export const updateProjectSchema = createUpdateSchema(projectsTable)

// Schemas for todos
export const selectTodoSchema = createSelectSchema(todosTable)
export const createTodoSchema = createInsertSchema(todosTable)
  .omit({
    created_at: true,
  })
  .openapi(`CreateTodo`)
export const updateTodoSchema = createUpdateSchema(todosTable)

// Schemas for folders
export const selectFolderSchema = createSelectSchema(foldersTable)
export const createFolderSchema = createInsertSchema(foldersTable)
  .omit({
    created_at: true,
    updated_at: true,
  })
  .openapi(`CreateFolder`)
export const updateFolderSchema = createUpdateSchema(foldersTable)

// Schemas for files (manual definition due to custom bytea type)
export const selectFileSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  folder_id: z.number().nullable(),
  name: z.string(),
  loro_snapshot: z.instanceof(Uint8Array).nullable(),
  created_at: z.date(),
  updated_at: z.date(),
})
export const createFileSchema = z
  .object({
    project_id: z.number(),
    folder_id: z.number().nullable(),
    name: z.string(),
    loro_snapshot: z.instanceof(Uint8Array).nullable().optional(),
  })
  .openapi(`CreateFile`)
export const updateFileSchema = z.object({
  project_id: z.number().optional(),
  folder_id: z.number().nullable().optional(),
  name: z.string().optional(),
  loro_snapshot: z.instanceof(Uint8Array).nullable().optional(),
})

export type Project = z.infer<typeof selectProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
export type Todo = z.infer<typeof selectTodoSchema>
export type UpdateTodo = z.infer<typeof updateTodoSchema>
export type Folder = z.infer<typeof selectFolderSchema>
export type UpdateFolder = z.infer<typeof updateFolderSchema>
export type File = z.infer<typeof selectFileSchema>
export type UpdateFile = z.infer<typeof updateFileSchema>

export const selectUsersSchema = createSelectSchema(users)
