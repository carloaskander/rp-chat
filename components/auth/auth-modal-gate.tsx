"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthModalGate({ children }: { children: React.ReactNode }) {
  const { closeAuthModal, isAuthModalOpen } = useAuth();

  useEffect(() => {
    if (!isAuthModalOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthModal();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeAuthModal, isAuthModalOpen]);

  return (
    <>
      <div
        aria-hidden={isAuthModalOpen}
        className={isAuthModalOpen ? "select-none blur-[6px]" : ""}
      >
        {children}
      </div>

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm sm:px-6">
          <div
            role="presentation"
            className="absolute inset-0"
            onClick={closeAuthModal}
          />
          <div className="relative z-10 w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
            <button
              type="button"
              aria-label="Close sign-in modal"
              onClick={closeAuthModal}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
            <AuthForm />
          </div>
        </div>
      )}
    </>
  );
}
