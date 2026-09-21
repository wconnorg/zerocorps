"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const inputClasses =
  "h-11 w-full rounded-lg border border-line-strong bg-bg px-3 text-base text-fg placeholder:text-subtle " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 " +
  "aria-invalid:border-danger";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
};

/** A labelled input with an optional hint and error, wired up for screen readers. */
export function Field({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(inputClasses, className)}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs/5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs/5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A password input that can be revealed. Pasting is allowed on purpose: password managers paste. */
export function PasswordField({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(inputClasses, "pr-16", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-medium text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs/5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs/5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Tone = "error" | "success" | "info";

const tones: Record<Tone, string> = {
  error: "border-danger/40 text-danger",
  success: "border-success/40 text-success",
  info: "border-line-strong text-muted",
};

/** A message about the whole form. Errors are announced to screen readers at once. */
export function FormMessage({ tone = "error", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border bg-bg px-3 py-2.5 text-sm/6", tones[tone])}
    >
      {children}
    </p>
  );
}
