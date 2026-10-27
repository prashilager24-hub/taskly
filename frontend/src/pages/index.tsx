import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui";
import {
  Card, CardBody, CardHeader, addToast,
  Button
} from "@/components/ui";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@heroui/shared-icons";
import { title } from "@/components/primitives";
import { subscribeToPush } from "../lib/pushClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgetEmail, setForgetEmail] = useState("");
  const [isForgot, setIsForgot] = useState(false);

  const navigate = useNavigate();
  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    const token = localStorage.getItem("authUserLD");
    if (token) navigate("/dashboard");
  }, []);

  //  Login handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgot) return handleForgotPassword();

    setIsLoading(true);
    try {
      const body = { username: email, password };
      const response = await axios.post(
        "/t2.0/authentificationUtilization/authenticate",
        body,
        { headers: { "Content-Type": "application/json" } }
      );

      const data = response.data;
      if (data.token) {
        try {
          localStorage.setItem("authUserLD", JSON.stringify(data));

          // 🚨 IMPORTANT CHECK
          const roleId = data.userRole;

          if (!roleId) {
            throw new Error("RoleID missing from login response");
          }

          const roleRes = await axios.get(
            `/t2.0/authentificationUtilization/AMRole/${roleId}`,
            {
              headers: {
                Authorization: `Bearer ${data.token}`,
              },
            }
          );

          if (roleRes.data?.status) {
            localStorage.setItem(
              "roles",
              JSON.stringify(roleRes.data.response || {})
            );
          } else {
            throw new Error(roleRes.data?.message || "Role fetch failed");
          }

          setIsLoading(false);

          addToast({
            title: "Login Successful",
            description: "Welcome back!",
            color: "success",
          });

          subscribeToPush().catch((err) =>
            console.error("Push subscribe failed:", err)
          );

          navigate("/dashboard");

        } catch (err: any) {
          console.error("Role API error:", err);

          setIsLoading(false);

          addToast({
            title: "Login succeeded but role fetch failed",
            description: err?.message || err?.response?.data?.message,
            color: "warning",
          });

          navigate("/dashboard");
        }
      }

      else {
        setIsLoading(false);

        addToast({
          title: "Invalid Credentials",
          description: "Login failed. Please check your credentials.",
          color: "danger",
        });
      }
    } catch (error) {
      setIsLoading(false);

      addToast({
        title: "Error",
        description: "Login failed. Try again.",
        color: "danger",
      });
    }
  };

  //  Forgot Password API handler
  const handleForgotPassword = async () => {
    if (!forgetEmail.trim()) {
      addToast({
        title: "Email Required",
        description: "Please enter your registered email.",
        color: "warning",
      });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        "/t2.0/authentificationUtilization/forgotPassword",
        { email: forgetEmail },
        { headers: { "Content-Type": "application/json" } }
      );

      addToast({
        title: "Reset Email Sent",
        description: "Check your inbox to reset your password.",
        color: "success",
      });

      setIsForgot(false);
      setForgetEmail("");
    } catch (err) {
      addToast({
        title: "Email Error",
        description: "Email not found or server error.",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center min-h-[100vh] py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 flex-col">
            <img
              src="/Tapmind.ico"
              alt="Taskly logo"
              className="w-10 h-10 rounded-md"
            />
            <h1 className={title({ size: "sm" })} style={{ color: "white" }}>Welcome to Taskly</h1>
          </div>
          <p className="text-default-500 mt-2 text-white">Sign in to your account</p>
        </div>


        <Card className="w-full">
          <CardHeader className="pb-0 pt-6 px-6">
            <h2 className="text-xl font-semibold">{isForgot ? "Reset Password" : "Login"}</h2>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Forgot Password View */}
              {isForgot ? (
                <>
                  <Input
                    type="email"
                    label="Registered Email"
                    placeholder="Enter your email"
                    value={forgetEmail}
                    onChange={(e) => setForgetEmail(e.target.value)}
                    isRequired
                    variant="bordered"
                  />

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    isLoading={isLoading}
                    size="lg"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>

                  <div
                    className="text-sm text-blue-600 cursor-pointer text-center mt-2"
                    onClick={() => setIsForgot(false)}
                  >
                    Back to Login
                  </div>
                </>
              ) : (
                <>
                  {/* Login Form */}
                  <Input
                    type="email"
                    label="Email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    isRequired
                    variant="bordered"
                  />

                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isRequired
                    variant="bordered"
                    endContent={
                      <button
                        type="button"
                        onClick={toggleVisibility}
                        className="focus:outline-none cursor-pointer"
                      >
                        {isVisible ? (
                          <EyeSlashFilledIcon className="text-2xl text-default-400" />
                        ) : (
                          <EyeFilledIcon className="text-2xl text-default-400" />
                        )}
                      </button>
                    }
                    type={isVisible ? "text" : "password"}
                  />

                  <div
                    className="text-sm text-blue-600 cursor-pointer  mt-1 hover:opacity-80"
                    onClick={() => setIsForgot(true)}
                    style={{ textDecoration: "none" }}
                  >
                    Forgot password?
                  </div>

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    isLoading={isLoading}
                    size="lg"
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </>
              )}

            </form>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
