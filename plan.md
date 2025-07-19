# Plan: Implement Folders and Files API Routes & Collections

## Overview

This plan outlines the implementation of API routes and TanStack DB collections for the new `folders` and `files` tables that were added in PR #4. The implementation will follow the existing patterns established for `todos` and `projects`.

## Database Schema (Already Implemented in PR #4)

### Folders Table

- `id` - Primary key (auto-generated)
- `project_id` - Foreign key to projects (with cascade delete)
- `parent_folder_id` - Self-referencing foreign key for hierarchical structure
- `name` - Folder name
- `created_at`, `updated_at` - Timestamps
- **Constraints**: Unique combination of (project_id, parent_folder_id, name)

### Files Table

- `id` - Primary key (auto-generated)
- `project_id` - Foreign key to projects (with cascade delete)
- `folder_id` - Foreign key to folders (nullable, with cascade delete)
- `name` - File name
- `loro_snapshot` - Custom bytea type (`Uint8Array`) for file data (nullable)
- `created_at`, `updated_at` - Timestamps
- **Constraints**: Unique combination of (folder_id, name)

### Relations

- Projects have many folders and files
- Folders belong to projects and can have parent/child relationships
- Files belong to projects and optionally to folders

## Implementation Plan

### 1. API Routes Setup (`src/routes/api/$.ts`)

#### Update Imports

```typescript
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
import { eq, and, or } from "drizzle-orm"
import { db } from "@/db/connection"
```

#### Add Folders CRUD Routes

```typescript
createCRUDRoutes({
  table: foldersTable,
  schema: {
    select: selectFolderSchema,
    create: createFolderSchema,
    update: updateFolderSchema,
  },
  basePath: "/api/folders",
  syncFilter: (session) =>
    `project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`,
  access: {
    create: async (session, data) => {
      // Verify user has access to the project
      const project = await db.query.projectsTable.findFirst({
        where: and(
          eq(projectsTable.id, data.project_id),
          or(
            eq(projectsTable.owner_id, session.user.id),
            sql`'${session.user.id}' = ANY(shared_user_ids)`
          )
        ),
      })
      if (!project) {
        throw new Error("Project not found or access denied")
      }

      // If parent_folder_id is specified, verify it exists and belongs to the same project
      if (data.parent_folder_id) {
        const parentFolder = await db.query.foldersTable.findFirst({
          where: and(
            eq(foldersTable.id, data.parent_folder_id),
            eq(foldersTable.project_id, data.project_id)
          ),
        })
        if (!parentFolder) {
          throw new Error("Parent folder not found or invalid")
        }
      }

      return true
    },
    update: (session, _id, _data) => {
      // Filter by projects user has access to
      return sql`project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`
    },
    delete: (session, _id) => {
      // Filter by projects user has access to
      return sql`project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`
    },
  },
})
```

#### Add Files CRUD Routes

```typescript
createCRUDRoutes({
  table: filesTable,
  schema: {
    select: selectFileSchema,
    create: createFileSchema,
    update: updateFileSchema,
  },
  basePath: "/api/files",
  syncFilter: (session) =>
    `project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`,
  access: {
    create: async (session, data) => {
      // Verify user has access to the project
      const project = await db.query.projectsTable.findFirst({
        where: and(
          eq(projectsTable.id, data.project_id),
          or(
            eq(projectsTable.owner_id, session.user.id),
            sql`'${session.user.id}' = ANY(shared_user_ids)`
          )
        ),
      })
      if (!project) {
        throw new Error("Project not found or access denied")
      }

      // If folder_id is specified, verify it exists and belongs to the same project
      if (data.folder_id) {
        const folder = await db.query.foldersTable.findFirst({
          where: and(
            eq(foldersTable.id, data.folder_id),
            eq(foldersTable.project_id, data.project_id)
          ),
        })
        if (!folder) {
          throw new Error("Folder not found or invalid")
        }
      }

      return true
    },
    update: (session, _id, _data) => {
      // Filter by projects user has access to
      return sql`project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`
    },
    delete: (session, _id) => {
      // Filter by projects user has access to
      return sql`project_id IN (SELECT id FROM projects WHERE owner_id = '${session.user.id}' OR '${session.user.id}' = ANY(shared_user_ids))`
    },
  },
})
```

### 2. TanStack DB Collections Setup (`src/lib/collections.ts`)

#### Update Imports

```typescript
import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { authClient } from "@/lib/auth-client"
import {
  selectTodoSchema,
  selectProjectSchema,
  selectUsersSchema,
  selectFolderSchema,
  selectFileSchema,
} from "@/db/schema"
import { getClient } from "@/api-client"
```

#### Add Folders Collection

```typescript
export const foldersCollection = createCollection(
  electricCollectionOptions({
    id: "folders",
    shapeOptions: {
      url: new URL(
        `/api/folders`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "folders",
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ``),
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectFolderSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newFolder } = transaction.mutations[0]
      const result = await client.api.folders.$post({
        json: {
          project_id: newFolder.project_id,
          parent_folder_id: newFolder.parent_folder_id,
          name: newFolder.name,
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedFolder } = transaction.mutations[0]
      const result = await client.api.folders[":id"].$put({
        param: {
          id: updatedFolder.id.toString(),
        },
        json: {
          project_id: updatedFolder.project_id,
          parent_folder_id: updatedFolder.parent_folder_id,
          name: updatedFolder.name,
        },
      })
      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedFolder } = transaction.mutations[0]
      const result = await client.api.folders[":id"].$delete({
        param: { id: deletedFolder.id.toString() },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
  })
)
```

#### Add Files Collection with Bytea Handling

```typescript
// Helper functions for bytea handling
const serializeBytea = (data: Uint8Array | null): string | null => {
  if (!data) return null
  // Convert Uint8Array to base64 for JSON transport
  return btoa(String.fromCharCode(...data))
}

const deserializeBytea = (data: string | null): Uint8Array | null => {
  if (!data) return null
  // Convert base64 back to Uint8Array
  const binaryString = atob(data)
  return new Uint8Array(binaryString.length).map((_, i) =>
    binaryString.charCodeAt(i)
  )
}

export const filesCollection = createCollection(
  electricCollectionOptions({
    id: "files",
    shapeOptions: {
      url: new URL(
        `/api/files`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "files",
        user_id: async () =>
          authClient
            .getSession()
            .then((session) => session.data?.user.id ?? ``),
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
        // Handle bytea field parsing from Electric
        loro_snapshot: (data: string | null) => deserializeBytea(data),
      },
    },
    schema: selectFileSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newFile } = transaction.mutations[0]
      const result = await client.api.files.$post({
        json: {
          project_id: newFile.project_id,
          folder_id: newFile.folder_id,
          name: newFile.name,
          // Handle bytea serialization for API transport
          loro_snapshot: serializeBytea(newFile.loro_snapshot),
        },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedFile } = transaction.mutations[0]
      const result = await client.api.files[":id"].$put({
        param: {
          id: updatedFile.id.toString(),
        },
        json: {
          project_id: updatedFile.project_id,
          folder_id: updatedFile.folder_id,
          name: updatedFile.name,
          loro_snapshot: serializeBytea(updatedFile.loro_snapshot),
        },
      })
      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedFile } = transaction.mutations[0]
      const result = await client.api.files[":id"].$delete({
        param: { id: deletedFile.id.toString() },
      })

      if (result.ok) {
        const data = await result.json()
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
  })
)
```

### 3. Access Control Strategy

#### Project-based Authorization

- Both folders and files inherit access control from their parent project
- Users can access folders/files only from projects they:
  - Own (`owner_id = session.user.id`)
  - Are shared with (`session.user.id` in `shared_user_ids` array)

#### Sync Filter Implementation

- Use subquery to filter by accessible projects
- Both folders and files will use similar filter logic
- Electric will only sync data from projects the user has access to

#### Enhanced Access Control Functions

```typescript
// Helper function to verify project access
const verifyProjectAccess = async (session: any, projectId: number) => {
  const project = await db.query.projectsTable.findFirst({
    where: and(
      eq(projectsTable.id, projectId),
      or(
        eq(projectsTable.owner_id, session.user.id),
        sql`'${session.user.id}' = ANY(shared_user_ids)`
      )
    ),
  })
  return !!project
}

// Helper function to verify folder belongs to project
const verifyFolderProject = async (folderId: number, projectId: number) => {
  const folder = await db.query.foldersTable.findFirst({
    where: and(
      eq(foldersTable.id, folderId),
      eq(foldersTable.project_id, projectId)
    ),
  })
  return !!folder
}
```

### 4. Implementation Steps

1. **Phase 1: API Routes**
   - [ ] Update imports in `src/routes/api/$.ts`
   - [ ] Add folders CRUD routes with enhanced access control
   - [ ] Add files CRUD routes with bytea handling
   - [ ] Add bytea serialization middleware for files API
   - [ ] Test CRUD operations via API

2. **Phase 2: Collections**
   - [ ] Update imports in `src/lib/collections.ts`
   - [ ] Add folders collection with corrected mutation patterns
   - [ ] Add files collection with bytea serialization helpers
   - [ ] Export collections properly
   - [ ] Test Electric sync functionality

3. **Phase 3: Testing & Validation**
   - [ ] Test folder hierarchy operations (parent/child relationships)
   - [ ] Test file operations with `loro_snapshot` field (small and large files)
   - [ ] Verify access control works correctly for shared projects
   - [ ] Test real-time sync across sessions
   - [ ] Test cascade delete scenarios

4. **Phase 4: Integration**
   - [ ] Update any existing UI components to use new collections
   - [ ] Add folder/file management interfaces if needed
   - [ ] Ensure proper error handling for bytea operations
   - [ ] Add loading states for large file operations

### 5. Special Considerations

#### Bytea Field Handling

- The `loro_snapshot` field uses custom bytea type (`Uint8Array`)
- Serialization to base64 for JSON transport over HTTP
- Deserialization back to `Uint8Array` in collections
- Handle null values appropriately
- Consider size limitations for HTTP requests (may need chunking for very large files)

#### Hierarchical Relationships

- Folders can have parent-child relationships (self-referencing)
- Need to handle cascade deletes properly (children deleted when parent is deleted)
- Consider implications for Electric sync ordering
- Prevent circular references in folder hierarchy

#### Performance Considerations

- Folder/file listings could be large for projects with many files
- Consider virtual scrolling or pagination for file listings
- Electric sync should be efficient with proper filtering
- Large `loro_snapshot` data may impact sync performance

#### Error Scenarios

- Handle unique constraint violations (duplicate names in same folder/project)
- Handle foreign key constraint violations (invalid project/folder references)
- Proper error messages for access control failures
- Handle bytea serialization/deserialization errors
- Handle network timeouts for large file operations

### 6. Dependencies

#### Already Available

- ✅ Database schema and migrations (PR #4)
- ✅ Zod schemas for validation
- ✅ `createCRUDRoutes` utility
- ✅ Electric collection options
- ✅ API client infrastructure

#### Need to Implement

- ❌ Enhanced access control helper functions
- ❌ Sync filter queries with proper SQL
- ❌ Bytea field serialization/deserialization helpers
- ❌ Collection mutation handlers with corrected patterns

### 7. Success Criteria

- [ ] Folders and files can be created, read, updated, and deleted via API
- [ ] Access control prevents unauthorized access to folders/files
- [ ] Electric sync works in real-time for folders and files
- [ ] Hierarchical folder structure is maintained correctly
- [ ] File data (`loro_snapshot`) is handled correctly with proper serialization
- [ ] All operations integrate seamlessly with existing project workflow
- [ ] Performance remains acceptable with large files and folder structures
