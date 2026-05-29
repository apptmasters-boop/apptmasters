"use client";
import { useEffect } from "react";

export default function DarkModeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return null;
}
