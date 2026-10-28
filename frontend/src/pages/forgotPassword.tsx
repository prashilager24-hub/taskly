import { useState } from "react";
import { Input } from "@/components/ui";
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    addToast,
} from "@/components/ui";
import queryString from 'query-string';
import { EyeFilledIcon, EyeSlashFilledIcon } from "@heroui/shared-icons";
import { title } from "@/components/primitives";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
    const [inputs, setInputs] = useState({
        newPassword: "",
        confirmPassword: ""
    });
    const parsed = queryString.parse(window.location.search);
    const [passwordValidity, setPasswordValidity] = useState({
        passwordLength: false,
        containNumbers: false,
        isUpperCase: false,
        isLowerCase: false,
        requireSymbols: false,
    });

    const [passwordMatch, setPasswordMatch] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const toggleVisibility = () => setIsVisible(!isVisible);

    const handleChange = (e) => {
        setPasswordMatch(true);
        const { name, value } = e.target;

        setInputs((prev) => ({ ...prev, [name]: value }));

        if (name === "newPassword") {
            const hasNumber = /\d/.test(value);
            const hasUpper = /[A-Z]/.test(value);
            const hasLower = /[a-z]/.test(value);
            const hasSymbol = /[^A-Za-z0-9]/.test(value);

            setPasswordValidity({
                passwordLength: value.length >= 8,
                containNumbers: hasNumber,
                isUpperCase: hasUpper,
                isLowerCase: hasLower,
                requireSymbols: hasSymbol,
            });
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();

        if (inputs.newPassword !== inputs.confirmPassword) {
            setPasswordMatch(false);
            return addToast({
                title: "Password Mismatch",
                description: "Both passwords must match.",
                color: "danger",
            });
        }

        // check all validations passed
        const allValid = Object.values(passwordValidity).every(Boolean);
        if (!allValid) {
            return addToast({
                title: "Weak Password",
                description: "Please meet all password requirements.",
                color: "warning",
            });
        }

        setLoading(true);
        try {
            // API call here
            await axios.post("/t2.0/authentificationUtilization/resetPassword", {
                password: inputs.newPassword,
                token: parsed.token
            });

            addToast({
                title: "Password Updated",
                description: "Your password has been reset successfully.",
                color: "success",
            });

            navigate("/");
        } catch (error) {
            addToast({
                title: "Failed",
                description: "Could not reset password.",
                color: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="flex flex-col items-center justify-center min-h-[80vh] py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className={title({ size: "md" })}>Reset Password</h1>
                    <p className="text-default-500 mt-2">Create a strong new password</p>
                </div>

                <Card>
                    <CardHeader className="pb-0 pt-6 px-6">
                        <h2 className="text-xl font-semibold">New Password</h2>
                    </CardHeader>

                    <CardBody className="px-6 pb-6">
                        <form onSubmit={handleReset} className="space-y-4">

                            <Input
                                label="New Password"
                                name="newPassword"
                                placeholder="Enter new password"
                                value={inputs.newPassword}
                                onChange={handleChange}
                                isRequired
                                variant="bordered"
                                type={isVisible ? "text" : "password"}
                                endContent={
                                    <button
                                        className="focus:outline-none cursor-pointer"
                                        type="button"
                                        onClick={toggleVisibility}
                                    >
                                        {isVisible ? (
                                            <EyeSlashFilledIcon className="text-2xl text-default-400" />
                                        ) : (
                                            <EyeFilledIcon className="text-2xl text-default-400" />
                                        )}
                                    </button>
                                }
                            />

                            {/* Password Strength Checklist */}
                            <div className="text-sm mt-1 space-y-1">
                                <p className={passwordValidity.passwordLength ? "text-emerald-600" : "text-rose-500"}>
                                    {passwordValidity.passwordLength ? "✔" : "✖"} At least 8 characters
                                </p>
                                <p className={passwordValidity.containNumbers ? "text-emerald-600" : "text-rose-500"}>
                                    {passwordValidity.containNumbers ? "✔" : "✖"} Contains number
                                </p>
                                <p className={passwordValidity.isUpperCase ? "text-emerald-600" : "text-rose-500"}>
                                    {passwordValidity.isUpperCase ? "✔" : "✖"} Uppercase letter
                                </p>
                                <p className={passwordValidity.isLowerCase ? "text-emerald-600" : "text-rose-500"}>
                                    {passwordValidity.isLowerCase ? "✔" : "✖"} Lowercase letter
                                </p>
                                <p className={passwordValidity.requireSymbols ? "text-emerald-600" : "text-rose-500"}>
                                    {passwordValidity.requireSymbols ? "✔" : "✖"} Special symbol
                                </p>
                            </div>

                            <Input
                                label="Confirm Password"
                                name="confirmPassword"
                                placeholder="Re-enter password"
                                value={inputs.confirmPassword}
                                onChange={handleChange}
                                isRequired
                                variant="bordered"
                                type={isVisible ? "text" : "password"}
                            />

                            {!passwordMatch && (
                                <p className="text-rose-500 text-sm">Passwords do not match</p>
                            )}

                            <Button
                                type="submit"
                                color="primary"
                                className="w-full"
                                isLoading={loading}
                                size="lg"
                            >
                                {loading ? "Updating..." : "Reset Password"}
                            </Button>
                        </form>
                    </CardBody>
                </Card>
            </div>
        </section>
    );
}
