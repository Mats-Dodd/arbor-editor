import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { filesCollection, foldersCollection } from "@/lib/collections"
import { type File } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Plus, Trash2, Edit, Download } from "lucide-react"

interface FileManagerProps {
  projectId: number
}

export function FileManager({ projectId }: FileManagerProps) {
  const [newFileName, setNewFileName] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [editingFile, setEditingFile] = useState<File | null>(null)
  const [editName, setEditName] = useState("")
  const [editContent, setEditContent] = useState("")
  const [filterFolderId, setFilterFolderId] = useState<number | "all" | "root">(
    "all"
  )

  const { data: files } = useLiveQuery(
    (q) =>
      q
        .from({ filesCollection })
        .where(({ filesCollection }) =>
          eq(filesCollection.project_id, projectId)
        )
        .orderBy(({ filesCollection }) => filesCollection.name),
    [projectId]
  )

  const { data: folders } = useLiveQuery(
    (q) =>
      q
        .from({ foldersCollection })
        .where(({ foldersCollection }) =>
          eq(foldersCollection.project_id, projectId)
        )
        .orderBy(({ foldersCollection }) => foldersCollection.name),
    [projectId]
  )

  // Filter files based on selected folder
  const filteredFiles =
    files?.filter((file) => {
      if (filterFolderId === "all") return true
      if (filterFolderId === "root") return file.folder_id === null
      return file.folder_id === filterFolderId
    }) || []

  // Helper functions for bytea handling
  const serializeContent = (content: string): Uint8Array => {
    return new TextEncoder().encode(content)
  }

  const deserializeContent = (data: Uint8Array | null): string => {
    if (!data) return ""
    return new TextDecoder().decode(data)
  }

  const createFile = () => {
    if (newFileName.trim()) {
      const content = "// New file\n"
      filesCollection.insert({
        id: Math.floor(Math.random() * 100000),
        project_id: projectId,
        folder_id: selectedFolderId,
        name: newFileName.trim(),
        loro_snapshot: serializeContent(content),
        created_at: new Date(),
        updated_at: new Date(),
      })
      setNewFileName("")
      setSelectedFolderId(null)
    }
  }

  const editFile = (file: File) => {
    setEditingFile(file)
    setEditName(file.name)
    setEditContent(deserializeContent(file.loro_snapshot))
  }

  const saveEdit = () => {
    if (editingFile && editName.trim()) {
      filesCollection.update(editingFile.id, (draft) => {
        draft.name = editName.trim()
        draft.loro_snapshot = serializeContent(editContent)
        draft.updated_at = new Date()
      })
      setEditingFile(null)
      setEditName("")
      setEditContent("")
    }
  }

  const cancelEdit = () => {
    setEditingFile(null)
    setEditName("")
    setEditContent("")
  }

  const deleteFile = (fileId: number) => {
    if (confirm("Are you sure you want to delete this file?")) {
      filesCollection.delete(fileId)
    }
  }

  const downloadFile = (file: File) => {
    const content = deserializeContent(file.loro_snapshot)
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getFolderName = (folderId: number | null): string => {
    if (!folderId) return "Root"
    const folder = folders?.find((f) => f.id === folderId)
    return folder?.name || "Unknown"
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-600" />
          Files
        </h3>
      </div>

      {/* Filter and new file controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Filter by folder */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Filter by folder:
          </label>
          <Select
            value={filterFolderId.toString()}
            onValueChange={(value) => {
              if (value === "all") setFilterFolderId("all")
              else if (value === "root") setFilterFolderId("root")
              else setFilterFolderId(parseInt(value))
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              <SelectItem value="root">Root (no folder)</SelectItem>
              {folders?.map((folder) => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* New file controls */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Create new file:
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFile()}
              placeholder="File name..."
              className="flex-1"
            />
            <Select
              value={selectedFolderId?.toString() || "root"}
              onValueChange={(value) => {
                setSelectedFolderId(value === "root" ? null : parseInt(value))
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Root</SelectItem>
                {folders?.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createFile} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Edit file dialog */}
      {editingFile && (
        <div className="mb-4 p-4 bg-green-50 rounded border">
          <div className="flex gap-2 mb-3">
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1"
              placeholder="File name..."
            />
            <Button onClick={saveEdit} size="sm">
              Save
            </Button>
            <Button onClick={cancelEdit} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
            placeholder="File content..."
          />
        </div>
      )}

      {/* Files list */}
      <div className="space-y-2">
        {filteredFiles.length > 0 ? (
          filteredFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border group hover:bg-gray-100"
            >
              <FileText className="w-4 h-4 text-green-600" />
              <div className="flex-1">
                <div className="font-medium text-sm">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {getFolderName(file.folder_id)} •{" "}
                  {file.updated_at.toLocaleString()}
                </div>
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadFile(file)}
                  className="h-8 w-8 p-0"
                  title="Download"
                >
                  <Download className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editFile(file)}
                  className="h-8 w-8 p-0"
                  title="Edit"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteFile(file.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            {filterFolderId === "all"
              ? "No files yet. Create one above!"
              : `No files in ${filterFolderId === "root" ? "root" : getFolderName(filterFolderId as number)}.`}
          </div>
        )}
      </div>
    </div>
  )
}
