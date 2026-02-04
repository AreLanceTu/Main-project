import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme || "light") === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  // Avoid hydration mismatch (theme resolved client-side).
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-xl"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
