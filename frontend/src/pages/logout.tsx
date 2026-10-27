import { useEffect } from "react";
import { Spinner } from "@heroui/react";

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

            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Logging Out…
            </h2>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Ending your session securely.
            </p>
        </div>
    );
};

export default Logout;
