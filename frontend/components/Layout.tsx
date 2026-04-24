"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, FileText, Receipt, User } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: FileText, label: "Create", path: "/create-invoice" },
    { icon: Receipt, label: "Invoices", path: "/invoices" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <div className="max-w-[390px] mx-auto w-full bg-white min-h-screen shadow-lg flex flex-col">
        <main className="flex-1 overflow-y-auto pb-20">{children}</main>

        {showNav && (
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-[390px] w-full bg-white border-t border-gray-200 px-4 py-2 z-50">
            <div className="flex justify-around items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className="flex flex-col items-center gap-1 py-2 px-4 min-w-[60px]"
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? "text-[#1B4332]" : "text-gray-400"}`}
                    />
                    <span
                      className={`text-xs ${isActive ? "text-[#1B4332]" : "text-gray-400"}`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
