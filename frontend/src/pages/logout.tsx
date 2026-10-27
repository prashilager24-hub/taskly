import { useEffect } from "react";
import { Spinner } from "@/components/ui";
import { clearSession } from "@/lib/session";

// Sign out ends the session on the server too (AUTH-04), so its token stops working everywhere
const Logout = () => {
    useEffect(() => {
        const done = () => {
            clearSession();
            window.location.href = "/";
        };
        fetch("/t2.0/authentificationUtilization/logout", { method: "POST", keepalive: true })
            .catch(() => undefined)
            .finally(done);
    }, []);
    return (
        <div className="
            flex flex-col items-center justify-center
        " style={{ height: "100vh" }}>

            <Spinner color="warning" size="lg" />

            <h2 className="text-lg font-semibold text-ink-800 dark:text-ink-200">
                Signing out…
            </h2>

            <p className="text-sm text-ink-500 dark:text-ink-400 text-center">
                Ending your session securely.
            </p>
        </div>
    );
};

export default Logout;
