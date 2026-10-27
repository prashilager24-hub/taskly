import { Navigate, Outlet } from "react-router-dom";

interface Props {
    children?: JSX.Element;
    adminOnly?: boolean;
    allowUserIds?: number[];
    salesOnly?: boolean;
    HrOnly?: boolean;
    TechOnly?: boolean;
    adminOrTech?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false, allowUserIds = [], salesOnly = false, HrOnly = false, TechOnly = false, adminOrTech = false }: Props) {
    const authUserLD = localStorage.getItem("authUserLD");

    // Not logged in → redirect to login
    if (!authUserLD) return <Navigate to="/" replace />;

    const user = JSON.parse(authUserLD);
    if (adminOrTech) {
        const isAdmin = user.userRole === 1;
        const isTech = user.departmentID === 24;

        if (!isAdmin && !isTech) {
            return <Navigate to="/dashboard" replace />;
        }
    }
    // Admin-only route check
    if (adminOnly && user.userRole !== 1 && !allowUserIds.includes(Number(user.userID))) {
        return <Navigate to="/dashboard" replace />;
    }
    if (salesOnly && user.departmentID !== 21) {
        return <Navigate to="/dashboard" replace />;
    }
    if (HrOnly && user.departmentID !== 22) {
        return <Navigate to="/dashboard" replace />;
    }
    if (TechOnly && user.departmentID !== 24) {
        return <Navigate to="/dashboard" replace />;
    }
    // If children exist → return them
    if (children) return children;

    return <Outlet />;
}
