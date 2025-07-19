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
const client = getClient()

export const usersCollection = createCollection(
  electricCollectionOptions({
    id: "users",
    shapeOptions: {
      url: new URL(
        `/api/users`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "users",
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
    schema: selectUsersSchema,
    getKey: (item) => item.id,
  })
)
export const projectCollection = createCollection(
  electricCollectionOptions({
    id: "projects",
    shapeOptions: {
      url: new URL(
        `/api/projects`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "projects",
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
    schema: selectProjectSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newProject } = transaction.mutations[0]
      const result = await client.api.projects.$post({
        json: {
          name: newProject.name,
          description: newProject.description,
          owner_id: newProject.owner_id,
          shared_user_ids: newProject.shared_user_ids,
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
      const { modified: updatedProject } = transaction.mutations[0]
      const result = await client.api.projects[":id"].$put({
        param: {
          id: updatedProject.id,
        },
        json: {
          name: updatedProject.name,
          description: updatedProject.description,
          shared_user_ids: updatedProject.shared_user_ids,
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
      const { original: deletedProject } = transaction.mutations[0]
      const result = await client.api.projects[":id"].$delete({
        param: { id: deletedProject.id },
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

export const todoCollection = createCollection(
  electricCollectionOptions({
    id: "todos",
    shapeOptions: {
      url: new URL(
        `/api/todos`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      params: {
        table: "todos",
        // Set the user_id as a param as a cache buster for when
        // you log in and out to test different accounts.
        user_id: async () =>
          authClient.getSession().then((session) => session.data?.user.id)!,
      },
      parser: {
        // Parse timestamp columns into JavaScript Date objects
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectTodoSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      const result = await client.api.todos.$post({
        json: {
          user_id: newTodo.user_id,
          text: newTodo.text,
          completed: newTodo.completed,
          project_id: newTodo.project_id,
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
      const { modified: updatedTodo } = transaction.mutations[0]
      const result = await client.api.todos[":id"].$put({
        param: {
          id: updatedTodo.id,
        },
        json: {
          text: updatedTodo.text,
          completed: updatedTodo.completed,
        },
      })
      if (result.ok) {
        const data = await result.json()
        console.log(data, typeof data.txid)
        return { txid: data.txid }
      } else {
        const errorData = await result.json()
        throw new Error(JSON.stringify(errorData))
      }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      const result = await client.api.todos[":id"].$delete({
        param: { id: deletedTodo.id },
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
