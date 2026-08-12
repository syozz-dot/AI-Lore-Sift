"use client";

import { CircleHalfTilt } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function resolveTheme(): Theme {
  const saved = window.localStorage.getItem("ann-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const initialTheme = resolveTheme();
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("ann-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <button
      className="iconButton"
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
    >
      <CircleHalfTilt aria-hidden="true" size={18} weight="regular" />
    </button>
  );
}
