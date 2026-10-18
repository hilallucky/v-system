import { Database, LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export interface AuthCredentials {
  fullName: string;
  email: string;
  password: string;
}

export function AuthPanel({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  error: string | null;
  onSubmit: (mode: "signup" | "login", credentials: AuthCredentials) => void;
}) {
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignUp = mode === "signup";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(mode, { fullName, email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#244b91] text-white">
            <Database size={21} />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">Eskayvie Bank Content</span>
            <span className="mt-0.5 block text-[11px] text-muted">Secure content workspace</span>
          </span>
        </div>
        <h1 className="text-xl font-semibold text-slate-800">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-xs text-muted">
          {isSignUp ? "Sign up to access your workspace." : "Log in to continue to your workspace."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {isSignUp && (
            <label className="block space-y-1.5 text-xs font-medium text-slate-700">
              Full name
              <Input
                required
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                placeholder="Your name"
              />
            </label>
          )}
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Email
            <Input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Password
            <Input
              required
              type="password"
              minLength={isSignUp ? 10 : undefined}
              maxLength={128}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={isSignUp ? "At least 10 characters" : "Your password"}
            />
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : isSignUp ? (
              <UserPlus size={15} />
            ) : (
              <LogIn size={15} />
            )}
            {isPending ? "Please wait…" : isSignUp ? "Create account" : "Log in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          {isSignUp ? "Already have an account?" : "New to the workspace?"}{" "}
          <button
            type="button"
            className="font-semibold text-[#4A2260] hover:text-[#754691] hover:underline"
            onClick={() => setMode(isSignUp ? "login" : "signup")}
          >
            {isSignUp ? "Log in" : "Create an account"}
          </button>
        </p>
      </Card>
    </main>
  );
}
