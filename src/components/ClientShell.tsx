"use client";
import { usePathname } from "next/navigation";
import Header from "./Header";
import { ReactNode } from "react";

export default function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideShell = pathname === "/login";
  return (
    <>
      {!hideShell && <Header />}
      {!hideShell ? (
        <div className="main-content">
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
}
