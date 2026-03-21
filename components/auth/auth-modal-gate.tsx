"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthModalGate({ children }: { children: React.ReactNode }) {
  const { authResolved, user } = useAuth();
  const shouldShowModal = authResolved && !user;

  return (
    <>
      <div
        aria-hidden={shouldShowModal}
        className={shouldShowModal ? "pointer-events-none select-none blur-[6px]" : ""}
      >
        {children}
      </div>

      {shouldShowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
            <AuthForm />
          </div>
        </div>
      )}
    </>
  );
}
