import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Outlet } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import {
  useLiveQuery,
  createCollection,
  liveQueryCollectionOptions,
  createLiveQueryCollection,
  not,
  like,
  count,
} from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import { Button } from "@/components/ui/button"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Plus, FolderIcon } from "lucide-react"

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  ssr: false,
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  console.log({ session, isPending })
  const navigate = useNavigate()
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  const countQuery = createLiveQueryCollection({
    query: (q) =>
      q.from({ projects: projectCollection }).select(({ projects }) => ({
        count: count(projects.id),
      })),
  })
  const newQuery = createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ projects: projectCollection })
          .where(({ projects }) => not(like(projects.name, `Default`))),
    })
  )

  const { data: notDefault } = useLiveQuery(newQuery)
  const { data: countData } = useLiveQuery(countQuery)
  console.log({ notDefault, countData })
  const { data: projects, isLoading } = useLiveQuery((q) =>
    q.from({ projectCollection })
  )

  useEffect(() => {
    if (!isPending && !session) {
      navigate({
        href: "/login",
      })
    }
  }, [session, isPending, navigate])

  useEffect(() => {
    if (session && projects && !isLoading) {
      const hasDefault = projects.some((p) => p.name === "Default")
      if (!hasDefault) {
        projectCollection.insert({
          id: Math.floor(Math.random() * 100000),
          name: "Default",
          description: "Default project",
          owner_id: session.user.id,
          shared_user_ids: [],
          created_at: new Date(),
        })
      }
    }
  }, [session, projects, isLoading])

  const handleLogout = async () => {
    await authClient.signOut()
    navigate({ to: "/login" })
  }

  const handleCreateProject = () => {
    if (newProjectName.trim() && session) {
      projectCollection.insert({
        id: Math.floor(Math.random() * 100000),
        name: newProjectName.trim(),
        description: "",
        owner_id: session.user.id,
        shared_user_ids: [],
        created_at: new Date(),
      })
      setNewProjectName("")
      setShowNewProjectForm(false)
    }
  }

  if (isPending) {
    return null
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Arbor Editor</h1>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction
              onClick={() => setShowNewProjectForm(!showNewProjectForm)}
              title="Add Project"
            >
              <Plus className="size-4" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              {showNewProjectForm && (
                <div className="mb-4 p-3 bg-muted rounded-md">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateProject()
                    }
                    placeholder="Project name"
                    className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={handleCreateProject} size="sm">
                      Create
                    </Button>
                    <Button
                      onClick={() => setShowNewProjectForm(false)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton asChild>
                      <Link
                        to="/project/$projectId"
                        params={{ projectId: project.id.toString() }}
                      >
                        <FolderIcon className="size-4" />
                        <span>{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-between w-full px-2 py-1">
                <span className="text-sm text-muted-foreground">
                  {session.user.email}
                </span>
                <Button onClick={handleLogout} variant="ghost" size="sm">
                  Sign out
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              TanStack DB / Electric Starter
            </h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
