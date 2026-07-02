import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Dumbbell, TrendingUp, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Dziś", icon: Home, exact: true },
  { to: "/cwicz", label: "Ćwicz", icon: Dumbbell, exact: false },
  { to: "/postepy", label: "Postępy", icon: TrendingUp, exact: false },
  { to: "/dane", label: "Dane", icon: HeartPulse, exact: false },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-hairline/70 bg-card/75 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {tabs.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition-colors",
                  active ? "bg-tint" : "bg-transparent",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
