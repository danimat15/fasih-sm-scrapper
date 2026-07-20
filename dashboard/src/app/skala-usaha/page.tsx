"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import {
  Building,
  TrendingUp,
  Search,
  Download,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Building2,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface SkalaUsahaRow {
  "Kode Kecamatan"?: string;
  "Nama Kecamatan"?: string;
  "nama_kec"?: string;
  "Nama Petugas"?: string;
  "Nama PCL"?: string;
  "Email Petugas"?: string;
  "Email PCL"?: string;
  "Nama PML"?: string;
  "Jabatan"?: string;
  "koseka"?: string;
  "Jumlah Prelist UB": number;
  "Jumlah UB yang Berhasil Didata": number;
  "Persentase UB yang Berhasil Didata": number;
  "Jumlah Prelist UMKM (UM + UMK)": number;
  "Jumlah UMKM yang Berhasil Didata (UM + UMK)": number;
  "Persentase UMKM yang Berhasil Didata (UM + UMK)": number;
  "Total Usaha Didata (UB + UM + UMK)": number;
}

export default function SkalaUsahaPage() {
  const [kecData, setKecData] = useState<SkalaUsahaRow[]>([]);
  const [petugasData, setPetugasData] = useState<SkalaUsahaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"kecamatan" | "petugas">("kecamatan");
  const [searchQuery, setSearchQuery] = useState("");
  const [kecFilter, setKecFilter] = useState("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const kecRes = await fetch("/data_mikro/kecamatan_skala_usaha.json");
        const petugasRes = await fetch("/data_mikro/petugas_skala_usaha.json");
        
        if (!kecRes.ok || !petugasRes.ok) {
          throw new Error("Gagal mengambil data skala usaha.");
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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, kecFilter, activeTab]);

  // Overall Stats
  const stats = useMemo(() => {
    let totalUBTarget = 0;
    let totalUBReal = 0;
    let totalUMKMTarget = 0;
    let totalUMKMReal = 0;

    kecData.forEach((row) => {
      totalUBTarget += row["Jumlah Prelist UB"] || 0;
      totalUBReal += row["Jumlah UB yang Berhasil Didata"] || 0;
      totalUMKMTarget += row["Jumlah Prelist UMKM (UM + UMK)"] || 0;
      totalUMKMReal += row["Jumlah UMKM yang Berhasil Didata (UM + UMK)"] || 0;
    });

    return {
      totalUBTarget,
      totalUBReal,
      ubPercent: totalUBTarget > 0 ? ((totalUBReal / totalUBTarget) * 100).toFixed(1) : "0.0",
      totalUMKMTarget,
      totalUMKMReal,
      umkmPercent: totalUMKMTarget > 0 ? ((totalUMKMReal / totalUMKMTarget) * 100).toFixed(1) : "0.0",
      grandTarget: totalUBTarget + totalUMKMTarget,
      grandReal: totalUBReal + totalUMKMReal,
      grandPercent: (totalUBTarget + totalUMKMTarget) > 0 
        ? (((totalUBReal + totalUMKMReal) / (totalUBTarget + totalUMKMTarget)) * 100).toFixed(1)
        : "0.0"
    };
  }, [kecData]);

  // Unique subdistricts list for filter dropdown
  const subdistricts = useMemo(() => {
    const list = new Set<string>();
    petugasData.forEach((p) => {
      if (p.nama_kec) list.add(p.nama_kec);
    });
    return Array.from(list).sort();
  }, [petugasData]);

  // Filter & Sort Data
  const sortedAndFilteredData = useMemo(() => {
    if (activeTab === "kecamatan") {
      let data = [...kecData];
      
      // Search filter for kecamatan
      if (searchQuery) {
        data = data.filter((row) =>
          row["Nama Kecamatan"]?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Sort
      if (sortConfig) {
        data.sort((a: any, b: any) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];
          if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });
      }
      return data;
    } else {
      let data = [...petugasData];
      
      // Filter by subdistrict
      if (kecFilter !== "all") {
        data = data.filter((row) => row.nama_kec === kecFilter);
      }

      // Search filter for Petugas
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        data = data.filter(
          (row) =>
            (row["Nama Petugas"] || row["Nama PCL"] || "").toLowerCase().includes(query) ||
            (row["Email Petugas"] || row["Email PCL"] || "").toLowerCase().includes(query) ||
            (row["Nama PML"] || "").toLowerCase().includes(query) ||
            (row["Jabatan"] || "").toLowerCase().includes(query) ||
            (row["koseka"] || "").toLowerCase().includes(query) ||
            (row["nama_kec"] || "").toLowerCase().includes(query)
        );
      }

      // Sort
      if (sortConfig) {
        data.sort((a: any, b: any) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];
          if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });
      }
      return data;
    }
  }, [kecData, petugasData, activeTab, searchQuery, kecFilter, sortConfig]);

  // Handle Sort Request
  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Pagination Logic
  const totalPages = Math.ceil(sortedAndFilteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredData.slice(start, start + itemsPerPage);
  }, [sortedAndFilteredData, currentPage]);

  // Download CSV helper
  const handleDownloadCSV = () => {
    const dataToExport = sortedAndFilteredData;
    if (dataToExport.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeTab === "kecamatan") {
      headers = [
        "Nama Kecamatan",
        "Target UB",
        "Realisasi UB",
        "Persentase UB (%)",
        "Target UMKM",
        "Realisasi UMKM",
        "Persentase UMKM (%)",
        "Total Target",
        "Total Realisasi"
      ];
      rows = dataToExport.map((r) => [
        r["Nama Kecamatan"] || "",
        String(r["Jumlah Prelist UB"]),
        String(r["Jumlah UB yang Berhasil Didata"]),
        String(r["Persentase UB yang Berhasil Didata"]),
        String(r["Jumlah Prelist UMKM (UM + UMK)"]),
        String(r["Jumlah UMKM yang Berhasil Didata (UM + UMK)"]),
        String(r["Persentase UMKM yang Berhasil Didata (UM + UMK)"]),
        String(r["Jumlah Prelist UB"] + r["Jumlah Prelist UMKM (UM + UMK)"]),
        String(r["Total Usaha Didata (UB + UM + UMK)"])
      ]);
    } else {
      headers = [
        "Nama Petugas",
        "Email Petugas",
        "Jabatan",
        "Koseka",
        "Kecamatan",
        "Target UB",
        "Realisasi UB",
        "Persentase UB (%)",
        "Target UMKM",
        "Realisasi UMKM",
        "Persentase UMKM (%)",
        "Total Target",
        "Total Realisasi"
      ];
      rows = dataToExport.map((r) => [
        r["Nama Petugas"] || r["Nama PCL"] || "",
        r["Email Petugas"] || r["Email PCL"] || "",
        r["Jabatan"] || "",
        r["koseka"] || "",
        r["nama_kec"] || r["Nama Kecamatan"] || "",
        String(r["Jumlah Prelist UB"] || 0),
        String(r["Jumlah UB yang Berhasil Didata"] || 0),
        String(r["Persentase UB yang Berhasil Didata"] || 0),
        String(r["Jumlah Prelist UMKM (UM + UMK)"] || 0),
        String(r["Jumlah UMKM yang Berhasil Didata (UM + UMK)"] || 0),
        String(r["Persentase UMKM yang Berhasil Didata (UM + UMK)"] || 0),
        String((r["Jumlah Prelist UB"] || 0) + (r["Jumlah Prelist UMKM (UM + UMK)"] || 0)),
        String(r["Total Usaha Didata (UB + UM + UMK)"] || 0)
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `skala_usaha_${activeTab}_export_${new Date().toISOString().split("T")[0]}.csv`
    );
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
              <Building className="w-6 h-6 text-orange-500" />
              Monitoring Skala Usaha
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Pemantauan target dan realisasi pendataan Usaha Besar (UB) vs UMKM secara real-time.
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
              <span className="text-xs font-medium text-slate-500">Memuat data mikro...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* UB Stats */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 dark:bg-orange-500/10 rounded-full translate-x-8 -translate-y-8 blur-md"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-100 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 px-2.5 py-0.5 rounded-full">
                    High Priority
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Usaha Besar (UB)</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{stats.totalUBReal}</span>
                  <span className="text-xs text-slate-400">dari {stats.totalUBTarget} didata</span>
                </div>
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Progres</span>
                    <span className="text-orange-500 font-bold">{stats.ubPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, parseFloat(stats.ubPercent))}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* UMKM Stats */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-500/10 rounded-full translate-x-8 -translate-y-8 blur-md"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 rounded-xl">
                    <Building className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-2.5 py-0.5 rounded-full">
                    Regular
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Usaha Mikro Kecil & Menengah</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{stats.totalUMKMReal}</span>
                  <span className="text-xs text-slate-400">dari {stats.totalUMKMTarget} didata</span>
                </div>
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Progres</span>
                    <span className="text-amber-500 font-bold">{stats.umkmPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, parseFloat(stats.umkmPercent))}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Combined Grand Stats */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full translate-x-8 -translate-y-8 blur-md"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                    Total
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Keseluruhan Usaha</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{stats.grandReal}</span>
                  <span className="text-xs text-slate-400">dari {stats.grandTarget} didata</span>
                </div>
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Progres Gabungan</span>
                    <span className="text-emerald-500 font-bold">{stats.grandPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, parseFloat(stats.grandPercent))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Section */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mb-8">
              {/* Tab Selector & Controls */}
              <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 self-start">
                  <button
                    onClick={() => {
                      setActiveTab("kecamatan");
                      setSortConfig(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "kecamatan"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Ringkasan Kecamatan
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("petugas");
                      setSortConfig(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "petugas"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Detail Petugas
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Kecamatan filter for Petugas tab */}
                  {activeTab === "petugas" && (
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

                  {/* Search Bar */}
                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder={activeTab === "kecamatan" ? "Cari kecamatan..." : "Cari petugas/email..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-orange-500"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {activeTab === "kecamatan" ? (
                        <>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah Prelist UB")}>
                            Target UB <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah UB yang Berhasil Didata")}>
                            Didata UB <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Persentase UB yang Berhasil Didata")}>
                            Progres UB (%) <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah Prelist UMKM (UM + UMK)")}>
                            Target UMKM <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah UMKM yang Berhasil Didata (UM + UMK)")}>
                            Didata UMKM <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Persentase UMKM yang Berhasil Didata (UM + UMK)")}>
                            Progres UMKM (%) <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Total Usaha Didata (UB + UM + UMK)")}>
                            Total Realisasi <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Nama Petugas</th>
                          <th className="px-6 py-4">Jabatan & Koseka</th>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah Prelist UB")}>
                            UB Target <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah UB yang Berhasil Didata")}>
                            UB Realisasi <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4">UB %</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah Prelist UMKM (UM + UMK)")}>
                            UMKM Target <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => requestSort("Jumlah UMKM yang Berhasil Didata (UM + UMK)")}>
                            UMKM Realisasi <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4">UMKM %</th>
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
                        const ubTarget = row["Jumlah Prelist UB"] || 0;
                        const ubReal = row["Jumlah UB yang Berhasil Didata"] || 0;
                        const ubPercent = row["Persentase UB yang Berhasil Didata"] || 0;

                        const umkmTarget = row["Jumlah Prelist UMKM (UM + UMK)"] || 0;
                        const umkmReal = row["Jumlah UMKM yang Berhasil Didata (UM + UMK)"] || 0;
                        const umkmPercent = row["Persentase UMKM yang Berhasil Didata (UM + UMK)"] || 0;

                        const isHighPriorityKec = activeTab === "kecamatan" && row["Nama Kecamatan"]?.includes("TIDAK DIKETAHUI");

                        if (activeTab === "kecamatan") {
                          if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {row["Nama Kecamatan"]}
                              </td>
                              <td className="px-6 py-4 font-semibold">{ubTarget}</td>
                              <td className="px-6 py-4">{ubReal}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(100, ubPercent)}%` }}></div>
                                  </div>
                                  <span className="font-bold text-orange-500">{ubPercent}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-semibold">{umkmTarget}</td>
                              <td className="px-6 py-4">{umkmReal}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, umkmPercent)}%` }}></div>
                                  </div>
                                  <span className="font-bold text-amber-500">{umkmPercent}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {row["Total Usaha Didata (UB + UM + UMK)"]}
                              </td>
                            </tr>
                          );
                        } else {
                          const namaPetugas = row["Nama Petugas"] || row["Nama PCL"];
                          const emailPetugas = row["Email Petugas"] || row["Email PCL"];
                          const jabatan = row["Jabatan"];
                          const koseka = row["koseka"];
                          const namaKec = row.nama_kec || row["Nama Kecamatan"];

                          if (!namaPetugas || namaPetugas === "NaN") return null;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 dark:text-white">{namaPetugas}</div>
                                {emailPetugas && <div className="text-[10px] text-slate-400 font-normal">{emailPetugas}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {jabatan && (
                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                                      {jabatan}
                                    </span>
                                  )}
                                  {koseka && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                                      {koseka}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500">{namaKec || "-"}</td>
                              <td className="px-6 py-4 font-semibold">{ubTarget}</td>
                              <td className="px-6 py-4">{ubReal}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  ubPercent >= 100 
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" 
                                    : ubPercent > 0 
                                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" 
                                      : "bg-slate-100 text-slate-400 dark:bg-slate-850"
                                }`}>
                                  {ubPercent}%
                                </span>
                              </td>
                              <td className="px-6 py-4 font-semibold">{umkmTarget}</td>
                              <td className="px-6 py-4">{umkmReal}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  umkmPercent >= 100 
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" 
                                    : umkmPercent > 0 
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" 
                                      : "bg-slate-100 text-slate-400 dark:bg-slate-850"
                                }`}>
                                  {umkmPercent}%
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>
                    Menampilkan {Math.min(sortedAndFilteredData.length, (currentPage - 1) * itemsPerPage + 1)} -{" "}
                    {Math.min(sortedAndFilteredData.length, currentPage * itemsPerPage)} dari {sortedAndFilteredData.length} data
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
