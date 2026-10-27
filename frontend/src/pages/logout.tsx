import { useEffect } from "react";
import { Spinner } from "@/components/ui";

const Logout = () => {
    useEffect(() => {

        const timeout = setTimeout(() => {

            localStorage.removeItem("authUserLD");
            window.location.href = "/";

        }, 200);

        return () => clearTimeout(timeout);

    }, []);
    return (
        <div className="
            flex flex-col items-center justify-center 
        " style={{ height: "100vh" }}>

            <Spinner color="warning" size="lg" />

            <h2 className="text-lg font-semibold text-ink-800 dark:text-ink-200">
                Logging Out…
            </h2>

            <p className="text-sm text-ink-500 dark:text-ink-400 text-center">
                Ending your session securely.
            </p>
        </div>
    );
};

export default Logout;
