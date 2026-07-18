"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Moon,
  Sun,
  ChevronDown,
  Layers,
  Building,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  FolderOpen,
  PieChart,
  Home,
  Users,
  Users2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reportDropdownRef = useRef<HTMLDivElement>(null);

  // Sync Dark Mode
  useEffect(() => {
    const darkModeTheme =
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDarkMode(darkModeTheme);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(event.target as Node)) {
        setIsReportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const menuItems = [
    { name: "Dashboard", href: "/" },
    { name: "Tabulasi", href: "/tabulasi" },
    { name: "Petugas", href: "/petugas" },
    { name: "Usaha", href: "/usaha" },
    { name: "Comparison SBR", href: "/comparison-sbr" },
    { name: "Anomali", href: "/anomali" },
  ];

  const dataMikroItems = [
    { name: "Skala Usaha UB & UMKM", href: "/skala-usaha", icon: Building },
    { name: "Keberadaan Usaha", href: "/keberadaan-usaha", icon: FolderOpen },
    { name: "Sektor Pertanian & Non-Pertanian", href: "/sektor-usaha", icon: PieChart },
    { name: "Keluarga & Demografi", href: "/keluarga-demografi", icon: Users2 },
  ];

  const reportItems = [
    { name: "Monitoring Kecamatan", href: "/report/monitoring", icon: TrendingUp },
    { name: "Leaderboard", href: "/report/leaderboard", icon: UserCheck },
    { name: "Report Muatan", href: "/report/muatan", icon: Layers },
  ];

  const isDataMikroActive = dataMikroItems.some((item) => pathname === item.href);
  const isReportActive = reportItems.some((item) => pathname === item.href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-xl text-white shadow-sm flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
                BPS Kabupaten Kepulauan Sangihe
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Dashboard Monitoring Sensus Ekonomi 2026
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-3 shrink-0">
            <nav className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50/50 dark:bg-slate-950/50 max-w-full flex-wrap">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                      isActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}

              {/* Data Mikro Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer ${
                    isDataMikroActive
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Data Mikro
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-lg ring-1 ring-black/5 dark:ring-white/5 focus:outline-none"
                    >
                      <div className="py-1 flex flex-col gap-1">
                        {dataMikroItems.map((subItem) => {
                          const Icon = subItem.icon;
                          const isSubActive = pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setIsDropdownOpen(false)}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                isSubActive
                                  ? "bg-orange-500 text-white"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Report Dropdown */}
              <div className="relative shrink-0" ref={reportDropdownRef}>
                <button
                  onClick={() => setIsReportDropdownOpen(!isReportDropdownOpen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer ${
                    isReportActive
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Report
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isReportDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isReportDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-lg ring-1 ring-black/5 dark:ring-white/5 focus:outline-none"
                    >
                      <div className="py-1 flex flex-col gap-1">
                        {reportItems.map((subItem) => {
                          const Icon = subItem.icon;
                          const isSubActive = pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setIsReportDropdownOpen(false)}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                isSubActive
                                  ? "bg-orange-500 text-white"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
              title="Ganti Tema"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-orange-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
