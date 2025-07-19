import { createServerFileRoute } from "@tanstack/react-start/server"
import { OpenAPIHono } from "@hono/zod-openapi"
import { createCRUDRoutes } from "@/lib/createCRUDRoutes"
import {
  todosTable,
  selectTodoSchema,
  createTodoSchema,
  updateTodoSchema,
  projectsTable,
  selectProjectSchema,
  createProjectSchema,
  updateProjectSchema,
  foldersTable,
  selectFolderSchema,
  createFolderSchema,
  updateFolderSchema,
  filesTable,
  selectFileSchema,
  createFileSchema,
  updateFileSchema,
} from "@/db/schema"
import { users } from "@/db/auth-schema"
import { eq, sql } from "drizzle-orm"

const routes = [
  createCRUDRoutes({
    table: projectsTable,
    schema: {
      select: selectProjectSchema,
      create: createProjectSchema,
      update: updateProjectSchema,
    },
    basePath: "/api/projects",
    syncFilter: (session) =>
      `owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids)`,
    access: {
      create: (session, data) => {
        if (data.owner_id === session.user.id) {
          return true
        } else {
          throw new Error(`You can only create projects you own`)
        }
      },
      update: (session, _id, _data) =>
        eq(projectsTable.owner_id, session.user.id),
      delete: (session, _id) => eq(projectsTable.owner_id, session.user.id),
    },
  }),
  createCRUDRoutes({
    table: foldersTable,
    schema: {
      select: selectFolderSchema,
      create: createFolderSchema,
      update: updateFolderSchema,
    },
    basePath: "/api/folders",
    // Remove subquery - Electric doesn't support subqueries in sync filters
    // For now, sync all folders and rely on access control for security
    syncFilter: () => `true`,
    access: {
      create: (_session, _data) => true,
      update: (session, _id, _data) => {
        // Use parameterized query for proper SQL binding
        return sql`project_id IN (SELECT id FROM projects WHERE owner_id = ${session.user.id} OR ${session.user.id} = ANY(shared_user_ids))`
      },
      delete: (session, _id) => {
        // Use parameterized query for proper SQL binding
        return sql`project_id IN (SELECT id FROM projects WHERE owner_id = ${session.user.id} OR ${session.user.id} = ANY(shared_user_ids))`
      },
    },
  }),
  createCRUDRoutes({
    table: filesTable,
    schema: {
      select: selectFileSchema,
      create: createFileSchema,
      update: updateFileSchema,
    },
    basePath: "/api/files",
    // Remove subquery - Electric doesn't support subqueries in sync filters
    // For now, sync all files and rely on access control for security
    syncFilter: () => `true`,
    access: {
      create: (_session, data) => {
        // Transform base64 string to Uint8Array for database storage
        if (data.loro_snapshot && typeof data.loro_snapshot === "string") {
          try {
            const binaryString = atob(data.loro_snapshot)
            data.loro_snapshot = new Uint8Array(binaryString.length).map(
              (_, i) => binaryString.charCodeAt(i)
            )
          } catch (_error) {
            throw new Error("Invalid base64 data for loro_snapshot")
          }
        }
        return true
      },
      update: (session, _id, data) => {
        // Transform base64 string to Uint8Array for database storage
        if (data.loro_snapshot && typeof data.loro_snapshot === "string") {
          try {
            const binaryString = atob(data.loro_snapshot)
            data.loro_snapshot = new Uint8Array(binaryString.length).map(
              (_, i) => binaryString.charCodeAt(i)
            )
          } catch (_error) {
            throw new Error("Invalid base64 data for loro_snapshot")
          }
        }
        // Use parameterized query for proper SQL binding
        return sql`project_id IN (SELECT id FROM projects WHERE owner_id = ${session.user.id} OR ${session.user.id} = ANY(shared_user_ids))`
      },
      delete: (session, _id) => {
        // Use parameterized query for proper SQL binding
        return sql`project_id IN (SELECT id FROM projects WHERE owner_id = ${session.user.id} OR ${session.user.id} = ANY(shared_user_ids))`
      },
    },
  }),
  createCRUDRoutes({
    table: todosTable,
    schema: {
      select: selectTodoSchema,
      create: createTodoSchema,
      update: updateTodoSchema,
    },
    basePath: "/api/todos",
    syncFilter: (session) => `'${session.user.id}' = ANY(user_ids)`,
    access: {
      create: (_session, _data) => true,
      update: (session, _id, _data) => eq(todosTable.user_id, session.user.id),
      delete: (session, _id) => eq(todosTable.user_id, session.user.id),
    },
  }),
  // Add sync route - anyone authenticated can sync all users.
  // Not particularly secure of course but works for this demo.
  createCRUDRoutes({
    table: users,
    basePath: "/api/users",
    access: {
      create: () => {
        throw new Error(`Can't create new users through REST API`)
      },
      update: () => {
        throw new Error(`Can't edit users through REST API`)
      },
      delete: () => {
        throw new Error(`Can't delete users through REST API`)
      },
    },
  }),
] as const
const app = new OpenAPIHono()

routes.forEach((route) => app.route(`/`, route))

const serve = ({ request }: { request: Request }) => {
  return app.fetch(request)
}

export type AppType = (typeof routes)[number]

export const ServerRoute = createServerFileRoute("/api/$").methods({
  GET: serve,
  POST: serve,
  PUT: serve,
  DELETE: serve,
  PATCH: serve,
  OPTIONS: serve,
  HEAD: serve,
})
