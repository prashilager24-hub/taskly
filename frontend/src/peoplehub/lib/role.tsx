
import { createContext, useCallback, useContext, useSyncExternalStore } from "react"
export type Role = "admin" | "employee"
import { ME } from "@/peoplehub/mocks/people"

/**
 * "View As" role switch for the blueprint.
 * Later this is replaced by the real session (JWT / SSO) from the backend.
 */
const KEY = "peoplehub.role"
const listeners = new Set<() => void>()

function read(): Role {
  try {
    return localStorage.getItem(KEY) === "employee" ? "employee" : "admin"
  } catch {
    return "admin"
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

type RoleCtx = { role: Role; setRole: (r: Role) => void; user: typeof ME }
const Ctx = createContext<RoleCtx | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribe, read, () => "admin" as Role)
  const setRole = useCallback((r: Role) => {
    try {
      localStorage.setItem(KEY, r)
    } catch {}
    listeners.forEach((l) => l())
  }, [])
  return <Ctx.Provider value={{ role, setRole, user: ME }}>{children}</Ctx.Provider>
}

export function useRole() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useRole must be used inside RoleProvider")
  return ctx
}
