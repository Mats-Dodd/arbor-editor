import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { foldersCollection } from "@/lib/collections"
import { type Folder } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  Plus,
  Trash2,
  Edit,
} from "lucide-react"

interface FolderManagerProps {
  projectId: number
}

interface FolderItemProps {
  folder: Folder
  allFolders: Folder[]
  level: number
  onCreateSubfolder: (parentId: number) => void
  onEdit: (folder: Folder) => void
  onDelete: (folderId: number) => void
}

function FolderItem({
  folder,
  allFolders,
  level,
  onCreateSubfolder,
  onEdit,
  onDelete,
}: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const subfolders = allFolders.filter((f) => f.parent_folder_id === folder.id)

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {subfolders.length > 0 ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <FolderIcon className="w-4 h-4 text-blue-600" />
        <span className="flex-1 text-sm">{folder.name}</span>

        <div className="hidden group-hover:flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCreateSubfolder(folder.id)}
            className="h-6 w-6 p-0"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(folder)}
            className="h-6 w-6 p-0"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(folder.id)}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {isExpanded &&
        subfolders.map((subfolder) => (
          <FolderItem
            key={subfolder.id}
            folder={subfolder}
            allFolders={allFolders}
            level={level + 1}
            onCreateSubfolder={onCreateSubfolder}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </div>
  )
}

export function FolderManager({ projectId }: FolderManagerProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [editName, setEditName] = useState("")
  const [parentFolderId, setParentFolderId] = useState<number | null>(null)

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

  const rootFolders = folders?.filter((f) => f.parent_folder_id === null) || []

  const createFolder = () => {
    if (newFolderName.trim()) {
      foldersCollection.insert({
        id: Math.floor(Math.random() * 100000),
        project_id: projectId,
        parent_folder_id: parentFolderId,
        name: newFolderName.trim(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      setNewFolderName("")
      setParentFolderId(null)
    }
  }

  const createSubfolder = (parentId: number) => {
    setParentFolderId(parentId)
    // Focus will be on the input when it appears
  }

  const editFolder = (folder: Folder) => {
    setEditingFolder(folder)
    setEditName(folder.name)
  }

  const saveEdit = () => {
    if (editingFolder && editName.trim()) {
      foldersCollection.update(editingFolder.id, (draft) => {
        draft.name = editName.trim()
        draft.updated_at = new Date()
      })
      setEditingFolder(null)
      setEditName("")
    }
  }

  const cancelEdit = () => {
    setEditingFolder(null)
    setEditName("")
  }

  const deleteFolder = (folderId: number) => {
    if (
      confirm(
        "Are you sure you want to delete this folder? This will also delete all subfolders and files."
      )
    ) {
      foldersCollection.delete(folderId)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FolderIcon className="w-5 h-5 text-blue-600" />
          Folders
        </h3>
      </div>

      {/* New folder input */}
      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createFolder()}
          placeholder={
            parentFolderId ? "New subfolder name..." : "New folder name..."
          }
          className="flex-1"
        />
        <Button onClick={createFolder} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add {parentFolderId ? "Subfolder" : "Folder"}
        </Button>
        {parentFolderId && (
          <Button
            onClick={() => setParentFolderId(null)}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Edit folder dialog */}
      {editingFolder && (
        <div className="flex gap-2 mb-4 p-3 bg-blue-50 rounded border">
          <Input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit()
              if (e.key === "Escape") cancelEdit()
            }}
            className="flex-1"
            autoFocus
          />
          <Button onClick={saveEdit} size="sm">
            Save
          </Button>
          <Button onClick={cancelEdit} variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      )}

      {/* Folder tree */}
      <div className="space-y-1">
        {rootFolders.length > 0 ? (
          rootFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              allFolders={folders || []}
              level={0}
              onCreateSubfolder={createSubfolder}
              onEdit={editFolder}
              onDelete={deleteFolder}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No folders yet. Create one above!
          </div>
        )}
      </div>
    </div>
  )
}
