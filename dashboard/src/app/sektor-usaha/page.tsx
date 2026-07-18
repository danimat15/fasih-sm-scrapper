"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import {
  PieChart as PieIcon,
  TrendingUp,
  Search,
  Download,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Leaf,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  TrendingDown
} from "lucide-react";

export default function SektorUsahaPage() {
  const [activeLevel, setActiveLevel] = useState<"kecamatan" | "petugas">("kecamatan");
  const [kecData, setKecData] = useState<any[]>([]);
  const [petugasData, setPetugasData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [kecFilter, setKecFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [kecRes, petugasRes] = await Promise.all([
          fetch("/data_mikro/kecamatan_sektor_usaha.json"),
          fetch("/data_mikro/petugas_sektor_usaha.json")
        ]);

        if (!kecRes.ok || !petugasRes.ok) {
          throw new Error("Gagal mengambil data sektor usaha.");
        }

        const kd = await kecRes.json();
        const pd = await petugasRes.json();

        setKecData(kd);
        setPetugasData(pd);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Terjadi kesalahan saat memuat data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Reset pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, kecFilter, activeLevel]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalPrelist = 0;
    let totalUTP = 0;
    let ditPertanian = 0;
    let ditNonPertanian = 0;
    let baruPertanian = 0;
    let baruNonPertanian = 0;

    kecData.forEach((row) => {
      totalPrelist += row["Jumlah Prelist Usaha SE2026"] || 0;
      totalUTP += row["Jumlah UTP Subsektor Target (ST2023)"] || 0;
      ditPertanian += row["USAHA DITEMUKAN - Pertanian"] || 0;
      ditNonPertanian += row["USAHA DITEMUKAN - Non Pertanian"] || 0;
      baruPertanian += row["USAHA BARU - Pertanian\u200b"] || row["USAHA BARU - Pertanian"] || 0;
      baruNonPertanian += row["USAHA BARU - Non Pertanian\u200b"] || row["USAHA BARU - Non Pertanian"] || 0;
    });

    const totalDitemukan = ditPertanian + ditNonPertanian;
    const totalBaru = baruPertanian + baruNonPertanian;

    return {
      totalPrelist,
      totalUTP,
      ditPertanian,
      ditNonPertanian,
      baruPertanian,
      baruNonPertanian,
      totalDitemukan,
      totalBaru,
      persenPertanian: totalDitemukan > 0 ? ((ditPertanian / totalDitemukan) * 100).toFixed(1) : "0.0",
      persenNonPertanian: totalDitemukan > 0 ? ((ditNonPertanian / totalDitemukan) * 100).toFixed(1) : "0.0"
    };
  }, [kecData]);

  // Unique list of subdistricts for filter
  const subdistricts = useMemo(() => {
    const list = new Set<string>();
    petugasData.forEach((p) => {
      if (p.nama_kec) list.add(p.nama_kec);
    });
    return Array.from(list).sort();
  }, [petugasData]);

  // Prepare current dataset based on filters and active selection
  const currentDataset = useMemo(() => {
    let data = activeLevel === "kecamatan" ? [...kecData] : [...petugasData];

    // Filter by Kecamatan dropdown for Petugas level
    if (activeLevel === "petugas" && kecFilter !== "all") {
      data = data.filter((row) => row.nama_kec === kecFilter);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (activeLevel === "kecamatan") {
        data = data.filter((row) =>
          (row["Nama Kecamatan"] || "").toLowerCase().includes(q)
        );
      } else {
        data = data.filter((row) =>
          (row["Nama PCL"] || "").toLowerCase().includes(q) ||
          (row["Email PCL"] || "").toLowerCase().includes(q) ||
          (row["Nama PML"] || "").toLowerCase().includes(q)
        );
      }
    }

    // Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [kecData, petugasData, activeLevel, searchQuery, kecFilter, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Pagination
  const totalPages = Math.ceil(currentDataset.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentDataset.slice(start, start + itemsPerPage);
  }, [currentDataset, currentPage]);

  // Export CSV
  const handleDownloadCSV = () => {
    if (currentDataset.length === 0) return;
    let headers: string[] = [];
    let rows: string[][] = [];

    const isKec = activeLevel === "kecamatan";
    headers = isKec
      ? ["Nama Kecamatan", "Prelist Usaha", "Jumlah UTP ST2023", "Ditemukan Pertanian", "Ditemukan Non-Pertanian", "Baru Pertanian", "Baru Non-Pertanian"]
      : ["Nama PCL", "Email PCL", "Nama PML", "Kecamatan", "Prelist Usaha", "Jumlah UTP ST2023", "Ditemukan Pertanian", "Ditemukan Non-Pertanian", "Baru Pertanian", "Baru Non-Pertanian"];
    
    rows = currentDataset.map((r) => {
      const preVal = r["Jumlah Prelist Usaha SE2026"] || 0;
      const utpVal = r["Jumlah UTP Subsektor Target (ST2023)"] || 0;
      const ditP = r["USAHA DITEMUKAN - Pertanian"] || 0;
      const ditNP = r["USAHA DITEMUKAN - Non Pertanian"] || 0;
      const barP = r["USAHA BARU - Pertanian\u200b"] || r["USAHA BARU - Pertanian"] || 0;
      const barNP = r["USAHA BARU - Non Pertanian\u200b"] || r["USAHA BARU - Non Pertanian"] || 0;

      return isKec
        ? [r["Nama Kecamatan"] || "", String(preVal), String(utpVal), String(ditP), String(ditNP), String(barP), String(barNP)]
        : [r["Nama PCL"] || "", r["Email PCL"] || "", r["Nama PML"] || "", r["nama_kec"] || "", String(preVal), String(utpVal), String(ditP), String(ditNP), String(barP), String(barNP)];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `proporsi_sektor_usaha_${activeLevel}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <PieIcon className="w-6 h-6 text-orange-500" />
              Sektor Usaha (Pertanian vs Non-Pertanian)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Rasio Usaha Pertanian vs Non-Pertanian (UTP) pada temuan lapangan usaha ditemukan maupun temuan usaha baru.
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-500" />
            Unduh CSV
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-slate-500">Memuat analisis sektoral...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Pertanian Stats */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm col-span-1 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                    Sektor Pertanian
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Usaha Pertanian Ditemukan</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.ditPertanian}</span>
                  <span className="text-xs text-slate-400">dari {stats.totalDitemukan} usaha ditemukan</span>
                </div>
                {/* Baru */}
                <div className="text-[10px] text-slate-400 mt-2 font-normal">
                  Usaha Pertanian Baru Teridentifikasi: <span className="font-bold text-slate-950 dark:text-white">+{stats.baruPertanian}</span>
                </div>
                {/* Visual Ratio */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Proporsi Sektoral</span>
                    <span className="text-emerald-500 font-bold">{stats.persenPertanian}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.persenPertanian}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Non-Pertanian Stats */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm col-span-1 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 rounded-xl">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 px-2.5 py-0.5 rounded-full">
                    Sektor Non-Pertanian
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Usaha Non-Pertanian Ditemukan</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-blue-500">{stats.ditNonPertanian}</span>
                  <span className="text-xs text-slate-400">dari {stats.totalDitemukan} usaha ditemukan</span>
                </div>
                {/* Baru */}
                <div className="text-[10px] text-slate-400 mt-2 font-normal">
                  Usaha Non-Pertanian Baru Teridentifikasi: <span className="font-bold text-slate-950 dark:text-white">+{stats.baruNonPertanian}</span>
                </div>
                {/* Visual Ratio */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Proporsi Sektoral</span>
                    <span className="text-blue-500 font-bold">{stats.persenNonPertanian}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.persenNonPertanian}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Interactive Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mb-8">
              {/* Controls */}
              <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 self-start">
                  <button
                    onClick={() => {
                      setActiveLevel("kecamatan");
                      setSortConfig(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeLevel === "kecamatan"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Ringkasan Kecamatan
                  </button>
                  <button
                    onClick={() => {
                      setActiveLevel("petugas");
                      setSortConfig(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeLevel === "petugas"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Detail Petugas
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Kecamatan selector for Petugas level */}
                  {activeLevel === "petugas" && (
                    <div className="relative shrink-0">
                      <select
                        value={kecFilter}
                        onChange={(e) => setKecFilter(e.target.value)}
                        className="w-full sm:w-48 appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-orange-500 cursor-pointer"
                      >
                        <option value="all">Semua Kecamatan</option>
                        {subdistricts.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  )}

                  {/* Search bar */}
                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder={activeLevel === "kecamatan" ? "Cari kecamatan..." : "Cari petugas/email..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-orange-500"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {activeLevel === "kecamatan" ? (
                        <>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Jumlah Prelist Usaha SE2026")}>
                            Target Prelist <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Jumlah UTP Subsektor Target (ST2023)")}>
                            UTP Target <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("USAHA DITEMUKAN - Pertanian")}>
                            Ditemukan Pertanian <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("USAHA DITEMUKAN - Non Pertanian")}>
                            Ditemukan Non-Pertanian <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("USAHA BARU - Pertanian")}>
                            Baru Pertanian <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("USAHA BARU - Non Pertanian")}>
                            Baru Non-Pertanian <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Nama Petugas</th>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4">Target Prelist</th>
                          <th className="px-6 py-4">UTP ST2023</th>
                          <th className="px-6 py-4">Ditemukan Pertanian</th>
                          <th className="px-6 py-4">Ditemukan Non-Pertanian</th>
                          <th className="px-6 py-4">Baru Pertanian</th>
                          <th className="px-6 py-4">Baru Non-Pertanian</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                          Tidak ditemukan data yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row, idx) => {
                        const preVal = row["Jumlah Prelist Usaha SE2026"] || 0;
                        const utpVal = row["Jumlah UTP Subsektor Target (ST2023)"] || 0;
                        const ditP = row["USAHA DITEMUKAN - Pertanian"] || 0;
                        const ditNP = row["USAHA DITEMUKAN - Non Pertanian"] || 0;
                        const barP = row["USAHA BARU - Pertanian\u200b"] || row["USAHA BARU - Pertanian"] || 0;
                        const barNP = row["USAHA BARU - Non Pertanian\u200b"] || row["USAHA BARU - Non Pertanian"] || 0;

                        if (activeLevel === "kecamatan") {
                          if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {row["Nama Kecamatan"]}
                              </td>
                              <td className="px-6 py-4 font-semibold">{preVal}</td>
                              <td className="px-6 py-4">{utpVal}</td>
                              <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">{ditP}</td>
                              <td className="px-6 py-4 text-blue-500 font-bold">{ditNP}</td>
                              <td className="px-6 py-4 text-emerald-500 font-medium">+{barP}</td>
                              <td className="px-6 py-4 text-blue-400 font-medium">+{barNP}</td>
                            </tr>
                          );
                        } else {
                          if (row["Nama PCL"] === "NaN" || !row["Nama PCL"]) return null;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 dark:text-white">{row["Nama PCL"]}</div>
                                <div className="text-[10px] text-slate-400 font-normal">{row["Email PCL"]}</div>
                              </td>
                              <td className="px-6 py-4 text-slate-500">{row.nama_kec}</td>
                              <td className="px-6 py-4 font-semibold">{preVal}</td>
                              <td className="px-6 py-4">{utpVal}</td>
                              <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">{ditP}</td>
                              <td className="px-6 py-4 text-blue-500 font-bold">{ditNP}</td>
                              <td className="px-6 py-4 text-emerald-500 font-medium">+{barP}</td>
                              <td className="px-6 py-4 text-blue-400 font-medium">+{barNP}</td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>
                    Menampilkan {Math.min(currentDataset.length, (currentPage - 1) * itemsPerPage + 1)} -{" "}
                    {Math.min(currentDataset.length, currentPage * itemsPerPage)} dari {currentDataset.length} data
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1 px-1 text-slate-700 dark:text-slate-300">
                      Page <span className="font-bold text-slate-900 dark:text-white px-1">{currentPage}</span> of{" "}
                      <span className="font-bold">{totalPages}</span>
                    </div>
                    <button
                      onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
