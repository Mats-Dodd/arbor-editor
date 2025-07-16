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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-semibold text-gray-900">
                TanStack DB / Electric Starter
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user.email}
              </span>
              <Button
                onClick={handleLogout}
                variant="ghost"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Projects</h2>
              <Button
                onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                variant="ghost"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </Button>
            </div>

            {showNewProjectForm && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  placeholder="Project name"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handleCreateProject}
                    variant="default"
                  >
                    Create
                  </Button>
                  <Button
                    onClick={() => setShowNewProjectForm(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <nav className="space-y-1">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to="/project/$projectId"
                  params={{ projectId: project.id.toString() }}
                  className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md hover:text-gray-900"
                >
                  {project.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
