"use client";
import { usePathname } from "next/navigation";
import Header from "./Header";
import LayoutWithMobileMenu from "./LayoutWithMobileMenu";
import { ReactNode } from "react";

export default function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideShell = pathname === "/login";
  return (
    <>
      {!hideShell && <Header />}
      {!hideShell ? (
        <LayoutWithMobileMenu>
          {children}
        </LayoutWithMobileMenu>
      ) : (
        children
      )}
    </>
  );
}
