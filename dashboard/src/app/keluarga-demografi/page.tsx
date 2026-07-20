"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import {
  Users,
  Search,
  Download,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Home,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin
} from "lucide-react";

export default function KeluargaDemografiPage() {
  const [activeSubTab, setActiveSubTab] = useState<"keluarga" | "anggota">("keluarga");
  const [activeLevel, setActiveLevel] = useState<"kecamatan" | "petugas">("kecamatan");

  const [kecKeluarga, setKecKeluarga] = useState<any[]>([]);
  const [petugasKeluarga, setPetugasKeluarga] = useState<any[]>([]);
  const [kecAnggota, setKecAnggota] = useState<any[]>([]);
  const [petugasAnggota, setPetugasAnggota] = useState<any[]>([]);

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
        const [kkRes, pkRes, kaRes, paRes] = await Promise.all([
          fetch("/data_mikro/kecamatan_keluarga.json"),
          fetch("/data_mikro/petugas_keluarga.json"),
          fetch("/data_mikro/kecamatan_anggota_keluarga.json"),
          fetch("/data_mikro/petugas_anggota_keluarga.json"),
        ]);

        if (!kkRes.ok || !pkRes.ok || !kaRes.ok || !paRes.ok) {
          throw new Error("Gagal mengambil data keluarga dan demografi.");
        }

        const kk = await kkRes.json();
        const pk = await pkRes.json();
        const ka = await kaRes.json();
        const pa = await paRes.json();

        setKecKeluarga(kk);
        setPetugasKeluarga(pk);
        setKecAnggota(ka);
        setPetugasAnggota(pa);
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

  // Overall Statistics based on active sub tab
  const stats = useMemo(() => {
    if (activeSubTab === "keluarga") {
      let prelist = 0;
      let ditemukan = 0;
      let baru = 0;
      let meninggal = 0;
      let tidakEligible = 0;
      let tidakDitemukan = 0;

      kecKeluarga.forEach((row) => {
        prelist += row["Prelist Awal"] || 0;
        ditemukan += row["Ditemukan"] || 0;
        baru += row["Keluarga Baru"] || 0;
        meninggal += row["Meninggal"] || 0;
        tidakEligible += row["Tidak Eligible"] || 0;
        
        // Handle potential different column names for tidak ditemukan / tidak dapat ditemui
        const td1 = row["Tidak Ditemukan"] || 0;
        const td2 = row["Tidak Dapat Ditemui Sampai Akhir Pendataan"] || 0;
        tidakDitemukan += (td1 + td2);
      });

      const totalRealisasi = ditemukan + meninggal + tidakEligible + tidakDitemukan;
      const persenProgres = prelist > 0 ? ((totalRealisasi / prelist) * 100).toFixed(1) : "0.0";

      return {
        prelist,
        ditemukan,
        baru,
        meninggal,
        tidakEligible,
        tidakDitemukan,
        totalRealisasi,
        persenProgres
      };
    } else {
      // Anggota Keluarga
      let tinggalBersama = 0;
      let baru = 0;
      let meninggal = 0;
      let pindahDN = 0;
      let pindahLN = 0;
      let tidakDitemukan = 0;
      let khusus = 0;

      kecAnggota.forEach((row) => {
        tinggalBersama += row["Tinggal Bersama Keluarga"] || 0;
        baru += row["Anggota Keluarga Baru"] || 0;
        meninggal += row["Meninggal"] || 0;
        pindahDN += row["Pindah Dalam Negeri (DN)"] || 0;
        pindahLN += row["Pindah Luar Negeri (LN)"] || 0;
        tidakDitemukan += row["Tidak Ditemukan"] || 0;
        khusus += row["Anggota Keluarga Khusus"] || 0;
      });

      const totalAnggota = tinggalBersama + baru + khusus;

      return {
        tinggalBersama,
        baru,
        meninggal,
        pindah: pindahDN + pindahLN,
        tidakDitemukan,
        khusus,
        totalAnggota
      };
    }
  }, [kecKeluarga, kecAnggota, activeSubTab]);

  // Unique list of subdistricts for filter
  const subdistricts = useMemo(() => {
    const list = new Set<string>();
    const activePetugasList = activeSubTab === "keluarga" ? petugasKeluarga : petugasAnggota;
    activePetugasList.forEach((p) => {
      if (p.nama_kec) list.add(p.nama_kec);
    });
    return Array.from(list).sort();
  }, [petugasKeluarga, petugasAnggota, activeSubTab]);

  // Filter and sort dataset
  const currentDataset = useMemo(() => {
    let data = [];
    if (activeSubTab === "keluarga") {
      data = activeLevel === "kecamatan" ? [...kecKeluarga] : [...petugasKeluarga];
    } else {
      data = activeLevel === "kecamatan" ? [...kecAnggota] : [...petugasAnggota];
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
  }, [kecKeluarga, petugasKeluarga, kecAnggota, petugasAnggota, activeSubTab, activeLevel, searchQuery, kecFilter, sortConfig]);

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

    if (activeSubTab === "keluarga") {
      headers = isKec
        ? ["Nama Kecamatan", "Prelist Awal", "Ditemukan", "Keluarga Baru", "Meninggal", "Tidak Eligible", "Tidak Ditemukan"]
        : ["Nama Petugas", "Email Petugas", "Jabatan", "Koseka", "Kecamatan", "Prelist Awal", "Ditemukan", "Keluarga Baru", "Meninggal", "Tidak Eligible", "Tidak Ditemukan"];
      
      rows = currentDataset.map((r) => {
        const td = (r["Tidak Ditemukan"] || 0) + (r["Tidak Dapat Ditemui Sampai Akhir Pendataan"] || 0);
        return isKec
          ? [
              r["Nama Kecamatan"] || "",
              String(r["Prelist Awal"] || 0),
              String(r["Ditemukan"] || 0),
              String(r["Keluarga Baru"] || 0),
              String(r["Meninggal"] || 0),
              String(r["Tidak Eligible"] || 0),
              String(td)
            ]
          : [
              r["Nama Petugas"] || r["Nama PCL"] || "",
              r["Email Petugas"] || r["Email PCL"] || "",
              r["Jabatan"] || "",
              r["koseka"] || "",
              r["nama_kec"] || r["Nama Kecamatan"] || "",
              String(r["Prelist Awal"] || 0),
              String(r["Ditemukan"] || 0),
              String(r["Keluarga Baru"] || 0),
              String(r["Meninggal"] || 0),
              String(r["Tidak Eligible"] || 0),
              String(td)
            ];
      });
    } else {
      headers = isKec
        ? ["Nama Kecamatan", "Tinggal Bersama", "Anggota Baru", "Meninggal", "Pindah", "Tidak Ditemukan", "Anggota Khusus"]
        : ["Nama Petugas", "Email Petugas", "Jabatan", "Koseka", "Kecamatan", "Tinggal Bersama", "Anggota Baru", "Meninggal", "Pindah", "Tidak Ditemukan", "Anggota Khusus"];
      
      rows = currentDataset.map((r) => {
        const pindah = (r["Pindah Dalam Negeri (DN)"] || 0) + (r["Pindah Luar Negeri (LN)"] || 0);
        return isKec
          ? [
              r["Nama Kecamatan"] || "",
              String(r["Tinggal Bersama Keluarga"] || 0),
              String(r["Anggota Keluarga Baru"] || 0),
              String(r["Meninggal"] || 0),
              String(pindah),
              String(r["Tidak Ditemukan"] || 0),
              String(r["Anggota Keluarga Khusus"] || 0)
            ]
          : [
              r["Nama Petugas"] || r["Nama PCL"] || "",
              r["Email Petugas"] || r["Email PCL"] || "",
              r["Jabatan"] || "",
              r["koseka"] || "",
              r["nama_kec"] || r["Nama Kecamatan"] || "",
              String(r["Tinggal Bersama Keluarga"] || 0),
              String(r["Anggota Keluarga Baru"] || 0),
              String(r["Meninggal"] || 0),
              String(pindah),
              String(r["Tidak Ditemukan"] || 0),
              String(r["Anggota Keluarga Khusus"] || 0)
            ];
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `keluarga_demografi_${activeSubTab}_${activeLevel}_export.csv`);
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
              <Users className="w-6 h-6 text-orange-500" />
              Keluarga & Dinamika Demografi
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Monitoring progres pemutakhiran keluarga/rumah tangga dan pergeseran demografis penduduk secara real-time.
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

        {/* Sub Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-800 mb-8 flex gap-4 overflow-x-auto scrollbar-none pb-px">
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
            Pemutakhiran Keluarga
          </button>
          <button
            onClick={() => {
              setActiveSubTab("anggota");
              setActiveLevel("kecamatan");
              setSortConfig(null);
            }}
            className={`border-b-2 px-1 pb-3 text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeSubTab === "anggota"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Dinamika Anggota Keluarga
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-slate-500">Memuat analisis kependudukan...</span>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards based on tab */}
            {activeSubTab === "keluarga" ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                {/* Prelist */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Prelist Awal</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.prelist}</div>
                </div>

                {/* Ditemukan */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Ditemukan
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.ditemukan}</div>
                </div>

                {/* Keluarga Baru */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <UserPlus className="w-4 h-4 text-orange-500" />
                    Keluarga Baru
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-orange-500">+{stats.baru}</div>
                </div>

                {/* Meninggal */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <UserMinus className="w-4 h-4 text-red-500" />
                    Meninggal
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-red-500">{stats.meninggal}</div>
                </div>

                {/* Tidak Eligible */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tidak Eligible</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.tidakEligible}</div>
                </div>

                {/* Tidak Ditemukan */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tidak Ditemukan</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.tidakDitemukan}</div>
                </div>
              </div>
            ) : (
              // Anggota Keluarga KPIs
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm col-span-2">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tinggal Bersama Keluarga</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.tinggalBersama}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    Anggota Baru
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">+{stats.baru}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <UserMinus className="w-4 h-4 text-red-500" />
                    Meninggal
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-red-500">{stats.meninggal}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Pindah</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.pindah}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Anggota Khusus</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">{stats.khusus}</div>
                </div>
              </div>
            )}

            {/* Table section */}
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
                  {/* Kecamatan dropdown */}
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

                  {/* Search Bar */}
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

              {/* Responsive table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {activeSubTab === "keluarga" ? (
                        activeLevel === "kecamatan" ? (
                          <>
                            <th className="px-6 py-4">Kecamatan</th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Prelist Awal")}>
                              Prelist Awal <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Ditemukan")}>
                              Ditemukan <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Keluarga Baru")}>
                              Keluarga Baru <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Meninggal")}>
                              Meninggal <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Tidak Eligible")}>
                              Tidak Eligible <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Total Hasil Pendataan")}>
                              Realisasi Pendataan <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 py-4">Nama Petugas</th>
                            <th className="px-6 py-4">Jabatan & Koseka</th>
                            <th className="px-6 py-4">Kecamatan</th>
                            <th className="px-6 py-4">Prelist Awal</th>
                            <th className="px-6 py-4">Ditemukan</th>
                            <th className="px-6 py-4">Keluarga Baru</th>
                            <th className="px-6 py-4">Meninggal</th>
                            <th className="px-6 py-4">Tidak Eligible</th>
                            <th className="px-6 py-4">Realisasi</th>
                          </>
                        )
                      ) : activeLevel === "kecamatan" ? (
                        <>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Tinggal Bersama Keluarga")}>
                            Tinggal Bersama <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Anggota Keluarga Baru")}>
                            Anggota Baru <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Meninggal")}>
                            Meninggal <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Pindah Dalam Negeri (DN)")}>
                            Pindah DN <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Pindah Luar Negeri (LN)")}>
                            Pindah LN <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850" onClick={() => requestSort("Anggota Keluarga Khusus")}>
                            Anggota Khusus <ArrowUpDown className="w-3 h-3 inline ml-1 text-slate-400" />
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Nama Petugas</th>
                          <th className="px-6 py-4">Jabatan & Koseka</th>
                          <th className="px-6 py-4">Kecamatan</th>
                          <th className="px-6 py-4">Tinggal Bersama</th>
                          <th className="px-6 py-4">Anggota Baru</th>
                          <th className="px-6 py-4">Meninggal</th>
                          <th className="px-6 py-4">Pindah DN</th>
                          <th className="px-6 py-4">Pindah LN</th>
                          <th className="px-6 py-4">Anggota Khusus</th>
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
                        if (activeSubTab === "keluarga") {
                          const pre = row["Prelist Awal"] || 0;
                          const dit = row["Ditemukan"] || 0;
                          const bar = row["Keluarga Baru"] || 0;
                          const men = row["Meninggal"] || 0;
                          const te = row["Tidak Eligible"] || 0;
                          const real = row["Total Hasil Pendataan"] || (dit + men + te);

                          if (activeLevel === "kecamatan") {
                            if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                  {row["Nama Kecamatan"]}
                                </td>
                                <td className="px-6 py-4 font-semibold">{pre}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">{dit}</td>
                                <td className="px-6 py-4 text-orange-500 font-semibold">+{bar}</td>
                                <td className="px-6 py-4 text-red-500 font-normal">{men}</td>
                                <td className="px-6 py-4 text-slate-400">{te}</td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{real}</td>
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
                                <td className="px-6 py-4 font-semibold">{pre}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">{dit}</td>
                                <td className="px-6 py-4 text-orange-500 font-medium">+{bar}</td>
                                <td className="px-6 py-4 text-red-500">{men}</td>
                                <td className="px-6 py-4 text-slate-400">{te}</td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{real}</td>
                              </tr>
                            );
                          }
                        } else {
                          // Anggota Keluarga
                          const ting = row["Tinggal Bersama Keluarga"] || 0;
                          const bar = row["Anggota Keluarga Baru"] || 0;
                          const men = row["Meninggal"] || 0;
                          const pdn = row["Pindah Dalam Negeri (DN)"] || 0;
                          const pln = row["Pindah Luar Negeri (LN)"] || 0;
                          const khus = row["Anggota Keluarga Khusus"] || 0;

                          if (activeLevel === "kecamatan") {
                            if (row["Nama Kecamatan"] === "NaN" || !row["Nama Kecamatan"]) return null;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                  {row["Nama Kecamatan"]}
                                </td>
                                <td className="px-6 py-4 font-semibold">{ting}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">+{bar}</td>
                                <td className="px-6 py-4 text-red-500 font-normal">{men}</td>
                                <td className="px-6 py-4 text-blue-500">{pdn}</td>
                                <td className="px-6 py-4 text-blue-400">{pln}</td>
                                <td className="px-6 py-4 text-orange-500 font-semibold">{khus}</td>
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
                                <td className="px-6 py-4 font-semibold">{ting}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">+{bar}</td>
                                <td className="px-6 py-4 text-red-500">{men}</td>
                                <td className="px-6 py-4 text-blue-500">{pdn}</td>
                                <td className="px-6 py-4 text-blue-400">{pln}</td>
                                <td className="px-6 py-4 text-orange-500 font-medium">{khus}</td>
                              </tr>
                            );
                          }
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
