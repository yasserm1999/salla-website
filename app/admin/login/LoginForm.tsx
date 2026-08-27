"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Signing in, in a way the browser can help with.
 *
 * Two things make a password manager offer to save: real name attributes on
 * the fields, and a submission it can see. Because this form posts by fetch
 * rather than navigating, browsers that support the credential store are also
 * told explicitly — otherwise the offer silently never appears and everyone
 * types their password by hand forever.
 */

/** Chrome and Edge have this; Safari and Firefox do not. Hence the guards. */
type PasswordCredentialCtor = new (data: {
  id: string;
  password: string;
  name?: string;
}) => Credential;

async function offerToSave(username: string, password: string) {
  try {
    const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor })
      .PasswordCredential;
    if (!Ctor || !navigator.credentials?.store) return;
    await navigator.credentials.store(new Ctor({ id: username, password, name: username }));
  } catch {
    // Saving the password is a courtesy. Failing at it must not stop a sign-in.
  }
}

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message ?? "That did not work.");
        return;
      }
      await offerToSave(username, password);
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      method="post"
      className="rounded-2xl border border-[#ece7e1] bg-white p-6 shadow-sm"
    >
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-[#546d83]">Username</span>
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2.5 text-sm outline-none focus:border-[#d8b98a]"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-[#546d83]">Password</span>
        <span className="relative block">
          <input
            name="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2.5 pr-16 text-sm outline-none focus:border-[#d8b98a]"
          />
          {/* Typing Kumar@Salla123 blind on a phone keyboard is how people get
              locked out; being able to look is worth more than the shoulder. */}
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-xs font-semibold text-[#8a9099] hover:text-[#26364d]"
          >
            {show ? "Hide" : "Show"}
          </button>
        </span>
      </label>

      <label className="mb-5 flex items-center gap-2.5 text-sm text-[#546d83]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-[#d8cbbd] accent-[#26364d]"
        />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="w-full rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white transition hover:bg-[#3f4f61] disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>

      <p className="mt-3 text-center text-xs text-[#b8b1a8]">
        {remember ? "Signed in for three months" : "Signed in for a week"}
      </p>
    </form>
  );
}
