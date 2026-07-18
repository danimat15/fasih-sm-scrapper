"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  Sun,
  RefreshCw,
  Download,
  ChevronDown,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  ArrowUpDown,
  Copy,
  Check,
  FileSpreadsheet,
  AlertTriangle
} from "lucide-react";

// --- Types ---
interface AnomalyDefinition {
  id: number;
  title: string;
  description: string;
}

interface AggregateData {
  last_updated: string;
  columns: string[];
  data: Record<string, any>[];
  total: Record<string, any> | null;
}

interface DetailData {
  last_updated: string;
  columns: string[];
  data: Record<string, any>[];
}

export default function AnomaliPage() {
  const [activeTab, setActiveTab] = useState<"keluarga" | "usaha">("keluarga");
  
  // Data States
  const [anomalyDefs, setAnomalyDefs] = useState<AnomalyDefinition[]>([]);
  const [aggregateData, setAggregateData] = useState<AggregateData | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting & Filtering States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAnomalyCol, setSelectedAnomalyCol] = useState<string>("All"); // dropdown for aggregate table
  
  // Detail table states
  const [detailSearch, setDetailSearch] = useState<string>("");
  const [detailKecFilter, setDetailKecFilter] = useState<string>("All");
  const [detailStatusFilter, setDetailStatusFilter] = useState<string>("All");
  const [detailAnomalyTypeFilter, setDetailAnomalyTypeFilter] = useState<string>("All");
  const [detailSortConfig, setDetailSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  
  // Aggregate sorting states
  const [agregatSortConfig, setAgregatSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "Kecamatan",
    direction: "asc"
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Load Data dynamically based on activeTab
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const defsRes = await fetch(`/anomali/jenis_${activeTab}.json`);
      const aggRes = await fetch(`/anomali/agregat_${activeTab}.json`);
      const detRes = await fetch(`/anomali/detail_${activeTab}.json`);

      if (!defsRes.ok || !aggRes.ok || !detRes.ok) {
        throw new Error(`Gagal memuat data anomali ${activeTab}.`);
      }

      const defsData = await defsRes.json();
      const aggData = await aggRes.json();
      const detData = await detRes.json();

      setAnomalyDefs(defsData);
      setAggregateData(aggData);
      setDetailData(detData);
      
      // Reset filter states when tab changes
      setSelectedAnomalyCol("All");
      setDetailSearch("");
      setDetailKecFilter("All");
      setDetailStatusFilter("All");
      setDetailAnomalyTypeFilter("All");
      setDetailSortConfig(null);
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to extract anomaly ID from string
  const getAnomalyId = (namaAnomali: string): number => {
    if (!namaAnomali) return 0;
    const match = namaAnomali.match(/Anomali\s*(?:Data\s*)?(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  // Get lists for filter dropdowns
  const kecamatansList = useMemo(() => {
    if (!detailData) return [];
    const uniqueKec = new Set<string>();
    detailData.data.forEach((row) => {
      if (row["Nama Kecamatan"]) {
        uniqueKec.add(row["Nama Kecamatan"].trim());
      }
    });
    return Array.from(uniqueKec).sort();
  }, [detailData]);

  // Statistics derived from details
  const stats = useMemo(() => {
    if (!detailData) return { total: 0, belum: 0, sudah: 0, rate: 0, uniqueAssignments: 0 };
    
    let total = detailData.data.length;
    let belum = 0;
    let sudah = 0;
    const uniqueAssignmentsSet = new Set<string>();

    detailData.data.forEach((row) => {
      const status = (row["Tindak Lanjut"] || "").toLowerCase();
      if (status.includes("belum")) {
        belum++;
      } else {
        sudah++;
      }
      if (row["Assignment ID"]) {
        uniqueAssignmentsSet.add(row["Assignment ID"]);
      }
    });

    const rate = total > 0 ? (sudah / total) * 100 : 0;
    return {
      total,
      belum,
      sudah,
      rate,
      uniqueAssignments: uniqueAssignmentsSet.size
    };
  }, [detailData]);

  // 1. Process AGREGAT Data (sorting)
  const sortedAggregateData = useMemo(() => {
    if (!aggregateData) return [];
    let items = [...aggregateData.data];
    
    if (agregatSortConfig) {
      items.sort((a, b) => {
        let aVal = a[agregatSortConfig.key];
        let bVal = b[agregatSortConfig.key];

        // Custom parser for specific columns
        if (agregatSortConfig.key.includes("Persentase")) {
          // values might be strings like "0,24" or float/int
          const parsePct = (val: any) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === "number") return val;
            return parseFloat(String(val).replace(",", "."));
          };
          aVal = parsePct(aVal);
          bVal = parsePct(bVal);
        }

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return agregatSortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return agregatSortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return agregatSortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [aggregateData, agregatSortConfig]);

  const requestAgregatSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      agregatSortConfig &&
      agregatSortConfig.key === key &&
      agregatSortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setAgregatSortConfig({ key, direction });
  };

  // 2. Process DETAIL Data (filtering & sorting)
  const filteredDetailData = useMemo(() => {
    if (!detailData) return [];
    
    return detailData.data.filter((row) => {
      // a. Search keyword match
      const keyword = detailSearch.toLowerCase().trim();
      const matchSearch =
        !keyword ||
        (row["Nama KRT"] || row["Nama Usaha"] || "").toLowerCase().includes(keyword) ||
        (row["Nama Kecamatan"] || "").toLowerCase().includes(keyword) ||
        (row["Nama Desa/Kel"] || "").toLowerCase().includes(keyword) ||
        (row["Kode SLS"] || "").toLowerCase().includes(keyword) ||
        (row["Assignment ID"] || "").toLowerCase().includes(keyword) ||
        (row["Email Petugas"] || "").toLowerCase().includes(keyword) ||
        (row["Nama Anomali"] || "").toLowerCase().includes(keyword);

      // b. Kecamatan filter
      const matchKec =
        detailKecFilter === "All" ||
        (row["Nama Kecamatan"] || "").trim() === detailKecFilter;

      // c. Status filter
      const status = (row["Tindak Lanjut"] || "").toLowerCase();
      const matchStatus =
        detailStatusFilter === "All" ||
        (detailStatusFilter === "belum" && status.includes("belum")) ||
        (detailStatusFilter === "sudah" && !status.includes("belum"));

      // d. Anomali Type filter
      const anomalyNum = getAnomalyId(row["Nama Anomali"]);
      const matchAnomalyType =
        detailAnomalyTypeFilter === "All" ||
        anomalyNum === parseInt(detailAnomalyTypeFilter);

      return matchSearch && matchKec && matchStatus && matchAnomalyType;
    });
  }, [detailData, detailSearch, detailKecFilter, detailStatusFilter, detailAnomalyTypeFilter]);

  // Sorted Detail Data
  const sortedDetailData = useMemo(() => {
    let items = [...filteredDetailData];
    if (detailSortConfig) {
      items.sort((a, b) => {
        const key = detailSortConfig.key;
        let aVal = a[key];
        let bVal = b[key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return detailSortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return detailSortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return detailSortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredDetailData, detailSortConfig]);

  const requestDetailSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      detailSortConfig &&
      detailSortConfig.key === key &&
      detailSortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setDetailSortConfig({ key, direction });
  };

  // Pagination slice
  const paginatedDetailData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedDetailData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedDetailData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedDetailData.length / rowsPerPage);

  // CSV Exporter
  const handleExportCSV = () => {
    if (!detailData || sortedDetailData.length === 0) return;
    
    // Determine the name column based on active tab
    const nameCol = activeTab === "keluarga" ? "Nama KRT" : "Nama Usaha";
    const headers = [
      "No",
      nameCol,
      "Kecamatan",
      "Desa/Kelurahan",
      "SLS",
      "Sub SLS",
      "Assignment ID",
      "Nama Anomali",
      "Tindak Lanjut",
      "Email Petugas",
      "Link Fasih"
    ];

    const csvRows = [headers.join(",")];

    sortedDetailData.forEach((row) => {
      const values = [
        row["No"] || "",
        `"${(row[nameCol] || "").replace(/"/g, '""')}"`,
        `"${(row["Nama Kecamatan"] || "").replace(/"/g, '""')}"`,
        `"${(row["Nama Desa/Kel"] || "").replace(/"/g, '""')}"`,
        `"${row["Kode SLS"] || ""}"`,
        `"${row["Sub SLS"] || ""}"`,
        `"${row["Assignment ID"] || ""}"`,
        `"${(row["Nama Anomali"] || "").replace(/"/g, '""')}"`,
        `"${row["Tindak Lanjut"] || ""}"`,
        `"${row["Email Petugas"] || ""}"`,
        `"${row["Link Fasih"] || ""}"`
      ];
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `detail_anomali_${activeTab}_filtered_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset pagination on search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [detailSearch, detailKecFilter, detailStatusFilter, detailAnomalyTypeFilter, rowsPerPage]);

  return (
    <div
      className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300"
    >
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
              Monitoring Anomali Data SE2026
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Halaman ini mengidentifikasi anomali data hasil pencacahan dan memantau status tindak lanjutnya.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <button
              onClick={fetchData}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Segarkan Data
            </button>
          </div>
          
          {/* Sub-Tab Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm self-start md:self-auto shrink-0">
            <button
              onClick={() => setActiveTab("keluarga")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "keluarga"
                  ? "bg-white dark:bg-slate-800 text-orange-500 dark:text-orange-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Anomali Keluarga
            </button>
            <button
              onClick={() => setActiveTab("usaha")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "usaha"
                  ? "bg-white dark:bg-slate-800 text-orange-500 dark:text-orange-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Anomali Usaha
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Memuat data anomali...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-6 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold">Error Memuat Data</h4>
              <p className="text-sm mt-0.5">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* 1. Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Total Kejadian Anomali
                  </span>
                  <span className="text-3xl font-extrabold text-slate-800 dark:text-white block mt-1">
                    {stats.total.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span>Jumlah Kasus Terdeteksi</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {stats.uniqueAssignments.toLocaleString("id-ID")} Dokumen Unique
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider block">
                    Belum Ditindaklanjuti
                  </span>
                  <span className="text-3xl font-extrabold text-red-600 dark:text-red-400 block mt-1">
                    {stats.belum.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span>Perlu Perbaikan data</span>
                  <span className="font-semibold text-red-500">
                    {stats.total > 0 ? ((stats.belum / stats.total) * 100).toFixed(1) : 0}% Kasus
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider block">
                    Sudah Ditindaklanjuti
                  </span>
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                    {stats.sudah.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span>Selesai Diperbaiki</span>
                  <span className="font-semibold text-emerald-500">
                    {stats.total > 0 ? ((stats.sudah / stats.total) * 100).toFixed(1) : 0}% Kasus
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Tingkat Penyelesaian
                  </span>
                  <span className="text-3xl font-extrabold text-orange-500 block mt-1">
                    {stats.rate.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${stats.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Jenis/Keterangan Anomali Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-orange-500" />
                Definisi Jenis Anomali ({activeTab === "keluarga" ? "Keluarga" : "Usaha"})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {anomalyDefs.map((def) => (
                  <div
                    key={def.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:border-orange-500/30 dark:hover:border-orange-500/30 transition-all group flex flex-col gap-2 relative overflow-hidden"
                  >
                    {/* Left Accent Bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-l-full transform -translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-sm shrink-0">
                      #{def.id}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                        {def.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {def.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Aggregate Table Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Agregat Anomali per Kecamatan
                  </h3>
                  {aggregateData && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Waktu Pembaruan data: {aggregateData.last_updated}
                    </p>
                  )}
                </div>

                {/* Dropdown Filter Column */}
                <div className="flex items-center gap-2 self-start lg:self-auto">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Fokus Tampilan:
                  </span>
                  <div className="relative">
                    <select
                      value={selectedAnomalyCol}
                      onChange={(e) => setSelectedAnomalyCol(e.target.value)}
                      className="appearance-none pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="All">Semua Anomali (Kumulatif)</option>
                      {anomalyDefs.map((def) => (
                        <option key={def.id} value={String(def.id)}>
                          Anomali {def.id} - {def.title.slice(0, 30)}...
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Table Aggregate */}
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                      <th
                        onClick={() => requestAgregatSort("Kecamatan")}
                        className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          Kecamatan
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => requestAgregatSort("Total Assignment")}
                        className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          Total Assignment
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>

                      {selectedAnomalyCol === "All" ? (
                        <>
                          <th className="py-3.5 px-4 text-center font-bold text-red-500 dark:text-red-400">
                            Total Belum Tindak Lanjut
                          </th>
                          <th className="py-3.5 px-4 text-center font-bold text-emerald-500 dark:text-emerald-400">
                            Total Sudah Tindak Lanjut
                          </th>
                          <th className="py-3.5 px-4 text-center font-bold text-orange-500 dark:text-orange-400">
                            Tindak Lanjut Rate
                          </th>
                        </>
                      ) : (
                        <>
                          <th
                            onClick={() =>
                              requestAgregatSort(`Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`)
                            }
                            className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              Belum Tindak Lanjut
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() =>
                              requestAgregatSort(`Persentase Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`)
                            }
                            className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              % Belum
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() =>
                              requestAgregatSort(`Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`)
                            }
                            className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              Sudah Tindak Lanjut
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() =>
                              requestAgregatSort(`Persentase Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`)
                            }
                            className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              % Sudah
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {sortedAggregateData.map((row, rIdx) => {
                      // Sum fields dynamically for All view
                      let totalBelum = 0;
                      let totalSudah = 0;
                      if (selectedAnomalyCol === "All") {
                        anomalyDefs.forEach((def) => {
                          totalBelum += parseInt(row[`Anomali ${def.id} - Belum Tindak Lanjut`] || 0);
                          totalSudah += parseInt(row[`Anomali ${def.id} - Sudah Tindak Lanjut`] || 0);
                        });
                      }

                      const totalAnomali = totalBelum + totalSudah;
                      const overallPct = totalAnomali > 0 ? (totalSudah / totalAnomali) * 100 : 100;

                      return (
                        <tr
                          key={row["Kode"] || rIdx}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                            {row["Kecamatan"]}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                            {(row["Total Assignment"] || 0).toLocaleString("id-ID")}
                          </td>

                          {selectedAnomalyCol === "All" ? (
                            <>
                              <td className="py-3 px-4 text-center font-bold text-red-500/90">
                                {totalBelum.toLocaleString("id-ID")}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-emerald-500/90">
                                {totalSudah.toLocaleString("id-ID")}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-bold text-orange-500">
                                    {overallPct.toFixed(1)}%
                                  </span>
                                  <div className="w-12 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block shrink-0">
                                    <div
                                      className="bg-orange-500 h-full rounded-full"
                                      style={{ width: `${overallPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                {(row[`Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`] || 0).toLocaleString("id-ID")}
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-red-500">
                                {row[`Persentase Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`]}%
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                {(row[`Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`] || 0).toLocaleString("id-ID")}
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-emerald-500">
                                {row[`Persentase Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`]}%
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* Grand Total Row */}
                    {aggregateData && aggregateData.total && (
                      <tr className="bg-slate-100/50 dark:bg-slate-900/60 font-bold border-t-2 border-slate-200 dark:border-slate-800">
                        <td className="py-3.5 px-4 text-slate-800 dark:text-white uppercase tracking-wider">
                          TOTAL KABUPATEN
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-700 dark:text-slate-300">
                          {(aggregateData.total["Total Assignment"] || 0).toLocaleString("id-ID")}
                        </td>

                        {selectedAnomalyCol === "All" ? (
                          (() => {
                            let totalBelum = 0;
                            let totalSudah = 0;
                            anomalyDefs.forEach((def) => {
                              totalBelum += parseInt(aggregateData.total?.[`Anomali ${def.id} - Belum Tindak Lanjut`] || 0);
                              totalSudah += parseInt(aggregateData.total?.[`Anomali ${def.id} - Sudah Tindak Lanjut`] || 0);
                            });
                            const totalAnomali = totalBelum + totalSudah;
                            const overallPct = totalAnomali > 0 ? (totalSudah / totalAnomali) * 100 : 100;
                            return (
                              <>
                                <td className="py-3.5 px-4 text-center text-red-600 dark:text-red-400">
                                  {totalBelum.toLocaleString("id-ID")}
                                </td>
                                <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">
                                  {totalSudah.toLocaleString("id-ID")}
                                </td>
                                <td className="py-3.5 px-4 text-center text-orange-500">
                                  {overallPct.toFixed(2)}%
                                </td>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <td className="py-3.5 px-4 text-center text-slate-800 dark:text-white">
                              {(aggregateData.total[`Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`] || 0).toLocaleString("id-ID")}
                            </td>
                            <td className="py-3.5 px-4 text-center text-red-500">
                              {aggregateData.total[`Persentase Anomali ${selectedAnomalyCol} - Belum Tindak Lanjut`]}%
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-800 dark:text-white">
                              {(aggregateData.total[`Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`] || 0).toLocaleString("id-ID")}
                            </td>
                            <td className="py-3.5 px-4 text-center text-emerald-500">
                              {aggregateData.total[`Persentase Anomali ${selectedAnomalyCol} - Sudah Tindak Lanjut`]}%
                            </td>
                          </>
                        )}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Detailed Data Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Data Rincian Anomali
                  </h3>
                  {detailData && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Waktu Pembaruan: {detailData.last_updated} | Ditemukan {filteredDetailData.length.toLocaleString("id-ID")} baris data
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* CSV Export Button */}
                  <button
                    onClick={handleExportCSV}
                    disabled={sortedDetailData.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor CSV</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-6">
                
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Cari Nama/Desa/ID/SLS..."
                    className="w-full pr-4 pl-9 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>

                {/* Kecamatan Filter */}
                <div className="relative">
                  <select
                    value={detailKecFilter}
                    onChange={(e) => setDetailKecFilter(e.target.value)}
                    className="w-full appearance-none pr-9 pl-8 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="All">Semua Kecamatan</option>
                    {kecamatansList.map((kec) => (
                      <option key={kec} value={kec}>
                        {kec}
                      </option>
                    ))}
                  </select>
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {/* Anomali Type Filter */}
                <div className="relative">
                  <select
                    value={detailAnomalyTypeFilter}
                    onChange={(e) => setDetailAnomalyTypeFilter(e.target.value)}
                    className="w-full appearance-none pr-9 pl-8 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="All">Semua Jenis Anomali</option>
                    {anomalyDefs.map((def) => (
                      <option key={def.id} value={String(def.id)}>
                        Anomali {def.id}
                      </option>
                    ))}
                  </select>
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {/* Tindak Lanjut Status Filter */}
                <div className="relative">
                  <select
                    value={detailStatusFilter}
                    onChange={(e) => setDetailStatusFilter(e.target.value)}
                    className="w-full appearance-none pr-9 pl-8 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="All">Semua Tindak Lanjut</option>
                    <option value="belum">Belum Tindak Lanjut</option>
                    <option value="sudah">Sudah Tindak Lanjut</option>
                  </select>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Detail Table */}
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl mb-4">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                      <th
                        onClick={() => requestDetailSort("No")}
                        className="py-3 px-3 w-12 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        No
                      </th>
                      <th
                        onClick={() => requestDetailSort(activeTab === "keluarga" ? "Nama KRT" : "Nama Usaha")}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center gap-1">
                          {activeTab === "keluarga" ? "Nama KRT" : "Nama Usaha"}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => requestDetailSort("Nama Kecamatan")}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Wilayah
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => requestDetailSort("Kode SLS")}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none text-center"
                      >
                        <div className="flex items-center justify-center gap-1">
                          SLS
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Assignment ID</th>
                      <th
                        onClick={() => requestDetailSort("Nama Anomali")}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Keterangan Anomali
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => requestDetailSort("Tindak Lanjut")}
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center justify-center gap-1">
                          Status
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Fasih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {paginatedDetailData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500 dark:text-slate-400">
                          Tidak ada data anomali yang sesuai dengan pencarian atau filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedDetailData.map((row, idx) => {
                        const nameField = activeTab === "keluarga" ? "Nama KRT" : "Nama Usaha";
                        const isBelum = (row["Tindak Lanjut"] || "").toLowerCase().includes("belum");
                        const slsDisplay = `${row["Kode SLS"] || ""}-${row["Sub SLS"] || ""}`;
                        const assignmentId = row["Assignment ID"] || "";
                        const truncatedId = assignmentId ? `${assignmentId.slice(0, 8)}...` : "-";

                        return (
                          <tr
                            key={row["Assignment ID"] + "-" + idx}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <td className="py-3 px-3 text-center text-slate-500 dark:text-slate-400">
                              {row["No"] || (currentPage - 1) * rowsPerPage + idx + 1}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                              {row[nameField] || "-"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                                {row["Nama Kecamatan"]}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                {row["Nama Desa/Kel"]}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-400">
                              {slsDisplay}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                              <div className="flex items-center gap-1.5">
                                <span title={assignmentId}>{truncatedId}</span>
                                {assignmentId && (
                                  <button
                                    onClick={() => handleCopy(assignmentId)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                                    title="Salin Assignment ID"
                                  >
                                    {copiedId === assignmentId ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-xs md:max-w-sm truncate" title={row["Nama Anomali"]}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                                  Anomali {getAnomalyId(row["Nama Anomali"])}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {row["Nama Anomali"]}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isBelum ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <Clock className="w-3 h-3" />
                                  Belum TL
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Sudah TL
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {row["Link Fasih"] ? (
                                <a
                                  href={row["Link Fasih"]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-orange-500 hover:bg-orange-500 hover:text-white dark:border-slate-700 dark:hover:bg-slate-800 transition-all"
                                  title="Buka di FASIH BPS"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Tampilkan</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(parseInt(e.target.value))}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-slate-500">baris</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold px-2">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 mt-12 transition-colors bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sistem Monitoring FASIH Sensus Ekonomi 2026 - BPS Kabupaten Kepulauan Sangihe
          </p>
        </div>
      </footer>
    </div>
  );
}
