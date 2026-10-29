import { Navigate, Outlet } from "react-router-dom";

import AccessDenied from "@/components/AccessDenied";
import { hasModuleAccess } from "@/lib/permissions";

interface Props {
    children?: JSX.Element;
    /** The access module this page belongs to (Access Management → roles, departments, users) */
    module?: string;
}

/** Signed in, and (when `module` is given) allowed to open that module */
export default function ProtectedRoute({ children, module }: Props) {
    if (!localStorage.getItem("authUserLD")) return <Navigate to="/" replace />;
    if (module && !hasModuleAccess(module)) return <AccessDenied module={module} />;
    return children ?? <Outlet />;
}
