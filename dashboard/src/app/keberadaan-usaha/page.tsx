"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import {
  FolderOpen,
  Building,
  TrendingUp,
  Search,
  Download,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Home,
  CheckCircle,
  XCircle,
  HelpCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers
} from "lucide-react";

export default function KeberadaanUsahaPage() {
  const [activeSubTab, setActiveSubTab] = useState<"perusahaan" | "keluarga" | "jaringan">("perusahaan");
  const [activeLevel, setActiveLevel] = useState<"kecamatan" | "petugas">("kecamatan");

  const [kecPerusahaan, setKecPerusahaan] = useState<any[]>([]);
  const [petugasPerusahaan, setPetugasPerusahaan] = useState<any[]>([]);
  const [kecKeluarga, setKecKeluarga] = useState<any[]>([]);
  const [petugasKeluarga, setPetugasKeluarga] = useState<any[]>([]);
  const [kecJaringan, setKecJaringan] = useState<any[]>([]);
  const [petugasJaringan, setPetugasJaringan] = useState<any[]>([]);
  
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
        const [kpRes, ppRes, kkRes, pkRes, kjRes, pjRes] = await Promise.all([
          fetch("/data_mikro/kecamatan_usaha_perusahaan.json"),
          fetch("/data_mikro/petugas_usaha_perusahaan.json"),
          fetch("/data_mikro/kecamatan_usaha_keluarga.json"),
          fetch("/data_mikro/petugas_usaha_keluarga.json"),
          fetch("/data_mikro/kecamatan_jaringan_usaha.json"),
          fetch("/data_mikro/petugas_jaringan_usaha.json"),
        ]);

        if (!kpRes.ok || !ppRes.ok || !kkRes.ok || !pkRes.ok || !kjRes.ok || !pjRes.ok) {
          throw new Error("Gagal mengambil data keberadaan usaha.");
        }

        const kp = await kpRes.json();
        const pp = await ppRes.json();
        const kk = await kkRes.json();
        const pk = await pkRes.json();
        const kj = await kjRes.json();
        const pj = await pjRes.json();

        setKecPerusahaan(kp);
        setPetugasPerusahaan(pp);
        setKecKeluarga(kk);
        setPetugasKeluarga(pk);
        setKecJaringan(kj);
        setPetugasJaringan(pj);
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
  }, [searchQuery, kecFilter, activeSubTab, activeLevel]);

  // Overall statistics for each tab
  const stats = useMemo(() => {
    let target = 0;
    let ditemukan = 0;
    let tutup = 0;
    let ganda = 0;
    let tidakDitemukan = 0;
    let baru = 0;

    if (activeSubTab === "perusahaan") {
      kecPerusahaan.forEach((row) => {
        target += row["Jumlah Prelist Usaha"] || 0;
        ditemukan += row["JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Ditemukan"] || 0;
        tutup += row["JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Tutup"] || 0;
        ganda += row["JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Ganda"] || 0;
        tidakDitemukan += row["JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan"] || 0;
        baru += row["JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Baru"] || 0;
      });
    } else if (activeSubTab === "keluarga") {
      kecKeluarga.forEach((row) => {
        target += row["Jumlah Usaha dalam Keluarga"] || 0;
        ditemukan += row["JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Ditemukan"] || 0;
        tutup += row["JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Tutup"] || 0;
        ganda += row["JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Ganda"] || 0;
        tidakDitemukan += row["JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan"] || 0;
        baru += row["JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Baru"] || 0;
      });
    } else {
      // Jaringan Usaha
      let tunggal = 0, pusat = 0, cabang = 0, perwakilan = 0, pabrik = 0, pembantu = 0;
      kecJaringan.forEach((row) => {
        tunggal += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Tunggal"] || 0;
        pusat += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Kantor Pusat"] || 0;
        cabang += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Cabang"] || 0;
        perwakilan += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Perwakilan"] || 0;
        pabrik += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Pabrik"] || 0;
        pembantu += row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Unit Pembantu"] || 0;
      });
      return { tunggal, pusat, cabang, perwakilan, pabrik, pembantu, totalJaringan: tunggal+pusat+cabang+perwakilan+pabrik+pembantu };
    }

    const totalRealisasi = ditemukan + tutup + ganda + tidakDitemukan;
    const persentaseDidata = target > 0 ? ((totalRealisasi / target) * 100).toFixed(1) : "0.0";

    return {
      target,
      ditemukan,
      tutup,
      ganda,
      tidakDitemukan,
      baru,
      totalRealisasi,
      persentaseDidata
    };
  }, [kecPerusahaan, kecKeluarga, kecJaringan, activeSubTab]);

  // Unique list of subdistricts for filter
  const subdistricts = useMemo(() => {
    const list = new Set<string>();
    const activePetugasList =
      activeSubTab === "perusahaan"
        ? petugasPerusahaan
        : activeSubTab === "keluarga"
        ? petugasKeluarga
        : petugasJaringan;
    activePetugasList.forEach((p) => {
      if (p.nama_kec) list.add(p.nama_kec);
    });
    return Array.from(list).sort();
  }, [petugasPerusahaan, petugasKeluarga, petugasJaringan, activeSubTab]);

  // Prepare current dataset based on filters and active selection
  const currentDataset = useMemo(() => {
    let data: any[] = [];
    if (activeSubTab === "perusahaan") {
      data = activeLevel === "kecamatan" ? [...kecPerusahaan] : [...petugasPerusahaan];
    } else if (activeSubTab === "keluarga") {
      data = activeLevel === "kecamatan" ? [...kecKeluarga] : [...petugasKeluarga];
    } else {
      data = activeLevel === "kecamatan" ? [...kecJaringan] : [...petugasJaringan];
    }

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
          (row["Nama Petugas"] || row["Nama PCL"] || "").toLowerCase().includes(q) ||
          (row["Email Petugas"] || row["Email PCL"] || "").toLowerCase().includes(q) ||
          (row["Nama PML"] || "").toLowerCase().includes(q) ||
          (row["Jabatan"] || "").toLowerCase().includes(q) ||
          (row["koseka"] || "").toLowerCase().includes(q) ||
          (row["nama_kec"] || "").toLowerCase().includes(q)
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
  }, [kecPerusahaan, petugasPerusahaan, kecKeluarga, petugasKeluarga, kecJaringan, petugasJaringan, activeSubTab, activeLevel, searchQuery, kecFilter, sortConfig]);

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

    if (activeSubTab === "jaringan") {
      const isKec = activeLevel === "kecamatan";
      headers = isKec
        ? ["Nama Kecamatan", "Tunggal", "Kantor Pusat", "Cabang", "Perwakilan", "Pabrik", "Unit Pembantu"]
        : ["Nama Petugas", "Email Petugas", "Jabatan", "Koseka", "Kecamatan", "Tunggal", "Kantor Pusat", "Cabang", "Perwakilan", "Pabrik", "Unit Pembantu"];
      rows = currentDataset.map((r) =>
        isKec
          ? [
              r["Nama Kecamatan"] || "",
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Tunggal"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Kantor Pusat"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Cabang"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Perwakilan"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Pabrik"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Unit Pembantu"] || 0)
            ]
          : [
              r["Nama Petugas"] || r["Nama PCL"] || "",
              r["Email Petugas"] || r["Email PCL"] || "",
              r["Jabatan"] || "",
              r["koseka"] || "",
              r["nama_kec"] || r["Nama Kecamatan"] || "",
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Tunggal"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Kantor Pusat"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Cabang"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Perwakilan"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Pabrik"] || 0),
              String(r["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Unit Pembantu"] || 0)
            ]
      );
    } else {
      const isKec = activeLevel === "kecamatan";
      headers = isKec
        ? ["Nama Kecamatan", "Target Prelist", "Ditemukan", "Baru", "Tutup", "Ganda", "Tidak Ditemukan"]
        : ["Nama Petugas", "Email Petugas", "Jabatan", "Koseka", "Kecamatan", "Target Prelist", "Ditemukan", "Baru", "Tutup", "Ganda", "Tidak Ditemukan"];
      
      const detKey = activeSubTab === "perusahaan" ? "BKU" : "KELUARGA";
      
      rows = currentDataset.map((r) => {
        const targetVal = r[activeSubTab === "perusahaan" ? "Jumlah Prelist Usaha" : "Jumlah Usaha dalam Keluarga"] || 0;
        const ditVal = r[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Ditemukan`] || 0;
        const barVal = r[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Baru`] || 0;
        const tutVal = r[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Tutup`] || 0;
        const ganVal = r[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Ganda`] || 0;
        const tdVal = r[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan`] || 0;
        
        return isKec
          ? [
              r["Nama Kecamatan"] || "",
              String(targetVal),
              String(ditVal),
              String(barVal),
              String(tutVal),
              String(ganVal),
              String(tdVal)
            ]
          : [
              r["Nama Petugas"] || r["Nama PCL"] || "",
              r["Email Petugas"] || r["Email PCL"] || "",
              r["Jabatan"] || "",
              r["koseka"] || "",
              r["nama_kec"] || r["Nama Kecamatan"] || "",
              String(targetVal),
              String(ditVal),
              String(barVal),
              String(tutVal),
              String(ganVal),
              String(tdVal)
            ];
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `keberadaan_usaha_${activeSubTab}_${activeLevel}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-orange-500" />
              Keberadaan Usaha & Kelembagaan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Analisis status keberadaan usaha lapangan (Ditemukan, Tutup, Ganda, Baru) dan struktur jaringan usaha.
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

        {/* Sub-Tab Selector */}
        <div className="border-b border-slate-200 dark:border-slate-800 mb-8 flex gap-4 overflow-x-auto scrollbar-none pb-px">
          <button
            onClick={() => {
              setActiveSubTab("perusahaan");
              setActiveLevel("kecamatan");
              setSortConfig(null);
            }}
            className={`border-b-2 px-1 pb-3 text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeSubTab === "perusahaan"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Usaha Perusahaan BKU
          </button>
          <button
            onClick={() => {
              setActiveSubTab("keluarga");
              setActiveLevel("kecamatan");
              setSortConfig(null);
            }}
            className={`border-b-2 px-1 pb-3 text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeSubTab === "keluarga"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Usaha Rumah Tangga / Keluarga
          </button>
          <button
            onClick={() => {
              setActiveSubTab("jaringan");
              setActiveLevel("kecamatan");
              setSortConfig(null);
            }}
            className={`border-b-2 px-1 pb-3 text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeSubTab === "jaringan"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Jaringan Kelembagaan
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-slate-500">Memuat karakteristik keberadaan...</span>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards based on sub-tab */}
            {activeSubTab !== "jaringan" ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {/* Ditemukan */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Ditemukan (Aktif)
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    {stats.ditemukan}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-1">
                    {stats.target && stats.target > 0 ? ((stats.ditemukan! / stats.target!) * 100).toFixed(1) : "0.0"}% dari prelist
                  </div>
                </div>

                {/* Baru */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    Usaha Baru
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    +{stats.baru}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-1">
                    Temuan usaha baru di lapangan
                  </div>
                </div>

                {/* Tutup */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Tutup Permanen
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    {stats.tutup}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-1">
                    {stats.target && stats.target > 0 ? ((stats.tutup! / stats.target!) * 100).toFixed(1) : "0.0"}% dari prelist
                  </div>
                </div>

                {/* Ganda */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Usaha Ganda
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    {stats.ganda}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-1">
                    Duplikasi pencatatan prelist
                  </div>
                </div>

                {/* Tidak Ditemukan */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    Tidak Ditemukan
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    {stats.tidakDitemukan}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-1">
                    Identitas/lokasi tidak valid
                  </div>
                </div>
              </div>
            ) : (
              // Jaringan Usaha KPI
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Usaha Tunggal</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).tunggal}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Kantor Pusat</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).pusat}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Cabang</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).cabang}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Perwakilan</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).perwakilan}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Pabrik</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).pabrik}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Unit Pembantu</div>
                  <div className="text-xl font-black text-slate-950 dark:text-white">{(stats as any).pembantu}</div>
                </div>
              </div>
            )}

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

              {/* Table rendering based on Tab */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {activeSubTab === "jaringan" ? (
                        activeLevel === "kecamatan" ? (
                          <>
                            <th className="px-6 py-4">Kecamatan</th>
                            <th className="px-6 py-4">Tunggal</th>
                            <th className="px-6 py-4">Kantor Pusat</th>
                            <th className="px-6 py-4">Cabang</th>
                            <th className="px-6 py-4">Perwakilan</th>
                            <th className="px-6 py-4">Pabrik</th>
                            <th className="px-6 py-4">Unit Pembantu</th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 py-4">Nama Petugas</th>
                            <th className="px-6 py-4">Jabatan & Koseka</th>
                            <th className="px-6 py-4">Kecamatan</th>
                            <th className="px-6 py-4">Tunggal</th>
                            <th className="px-6 py-4">Kantor Pusat</th>
                            <th className="px-6 py-4">Cabang</th>
                            <th className="px-6 py-4">Perwakilan</th>
                            <th className="px-6 py-4">Pabrik</th>
                            <th className="px-6 py-4">Unit Pembantu</th>
                          </>
                        )
                      ) : activeLevel === "kecamatan" ? (
                        <>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "Jumlah Prelist Usaha" : "Jumlah Usaha dalam Keluarga")}>
                            Target Prelist <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Ditemukan" : "JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Ditemukan")}>
                            Ditemukan <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Baru" : "JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Baru")}>
                            Baru <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Tutup" : "JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Tutup")}>
                            Tutup <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Ganda" : "JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Ganda")}>
                            Ganda <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort(activeSubTab === "perusahaan" ? "JUMLAH USAHA BKU MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan" : "JUMLAH USAHA KELUARGA MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan")}>
                            Tidak Ditemukan <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Nama Petugas</th>
                          <th className="px-6 py-4">Jabatan & Koseka</th>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4">Target Prelist</th>
                          <th className="px-6 py-4">Ditemukan</th>
                          <th className="px-6 py-4">Baru</th>
                          <th className="px-6 py-4">Tutup</th>
                          <th className="px-6 py-4">Ganda</th>
                          <th className="px-6 py-4">Tidak Ditemukan</th>
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
                        if (activeSubTab === "jaringan") {
                          if (activeLevel === "kecamatan") {
                            if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                  {row["Nama Kecamatan"]}
                                </td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Tunggal"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Kantor Pusat"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Cabang"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Perwakilan"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Pabrik"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Unit Pembantu"] || 0}</td>
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
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Tunggal"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Kantor Pusat"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Cabang"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Perwakilan"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Pabrik"] || 0}</td>
                                <td className="px-6 py-4">{row["JUMLAH USAHA BERDASARKAN JARINGAN USAHA - Unit Pembantu"] || 0}</td>
                              </tr>
                            );
                          }
                        }

                        const detKey = activeSubTab === "perusahaan" ? "BKU" : "KELUARGA";
                        const targetVal = row[activeSubTab === "perusahaan" ? "Jumlah Prelist Usaha" : "Jumlah Usaha dalam Keluarga"] || 0;
                        const ditVal = row[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Ditemukan`] || 0;
                        const barVal = row[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Baru`] || 0;
                        const tutVal = row[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Tutup`] || 0;
                        const ganVal = row[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Ganda`] || 0;
                        const tdVal = row[`JUMLAH USAHA ${detKey} MENURUT STATUS KEBERADAAN USAHA - Tidak Ditemukan`] || 0;

                        if (activeLevel === "kecamatan") {
                          if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {row["Nama Kecamatan"]}
                              </td>
                              <td className="px-6 py-4 font-bold">{targetVal}</td>
                              <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">{ditVal}</td>
                              <td className="px-6 py-4 text-orange-500 font-semibold">+{barVal}</td>
                              <td className="px-6 py-4 text-red-500 font-normal">{tutVal}</td>
                              <td className="px-6 py-4 text-amber-500 font-normal">{ganVal}</td>
                              <td className="px-6 py-4 text-slate-400">{tdVal}</td>
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
                              <td className="px-6 py-4 font-bold">{targetVal}</td>
                              <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">{ditVal}</td>
                              <td className="px-6 py-4 text-orange-500 font-medium">+{barVal}</td>
                              <td className="px-6 py-4 text-red-500">{tutVal}</td>
                              <td className="px-6 py-4 text-amber-500">{ganVal}</td>
                              <td className="px-6 py-4 text-slate-400">{tdVal}</td>
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
