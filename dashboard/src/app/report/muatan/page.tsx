"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Download, Search, RefreshCw, FileText, ArrowUpDown, Info } from "lucide-react";
import Navbar from "@/components/Navbar";

interface StatusMuatanItem {
  rank: number;
  nama: string;
  jabatan: "PML" | "PCL";
  kecamatan: string;
  kel_td: number;
  kel_b: number;
  kel_sel: number;
  ush_td: number;
  ush_b: number;
  ush_sel: number;
  tot_td: number;
  tot_b: number;
  tot_sel: number;
}

interface ReportData {
  date: string;
  time: string;
  status_muatan?: StatusMuatanItem[];
}

export default function MuatanReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>("all");
  const [selectedJabatan, setSelectedJabatan] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof StatusMuatanItem; direction: "asc" | "desc" } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/report_data.json");
      if (!res.ok) {
        throw new Error("Gagal memuat data laporan.");
      }
      const jsonData = await res.json();
      setData(jsonData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const items = useMemo(() => {
    if (!data || !data.status_muatan) return [];
    return data.status_muatan;
  }, [data]);

  // Extract unique kecamatan names dynamically from the data
  const uniqueKecamatans = useMemo(() => {
    if (!data || !data.status_muatan) return [];
    const kecs = data.status_muatan
      .map((item) => item.kecamatan)
      .filter((kec) => kec && kec !== "-");
    
    const individualKecs: string[] = [];
    kecs.forEach(k => {
      k.split(",").forEach(part => {
        const trimmed = part.trim();
        if (trimmed && !individualKecs.includes(trimmed)) {
          individualKecs.push(trimmed);
        }
      });
    });
    return individualKecs.sort();
  }, [data]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search term filter
      const matchesSearch =
        item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Kecamatan filter (accounts for comma-separated list of kecamatan)
      const matchesKecamatan =
        selectedKecamatan === "all" ||
        item.kecamatan
          .split(",")
          .map(k => k.trim().toLowerCase())
          .includes(selectedKecamatan.toLowerCase());
      
      // Jabatan filter
      const matchesJabatan =
        selectedJabatan === "all" ||
        item.jabatan === selectedJabatan;
      
      return matchesSearch && matchesKecamatan && matchesJabatan;
    });
  }, [items, searchTerm, selectedKecamatan, selectedJabatan]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;
    const sorted = [...filteredItems].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      // Rule: empty / "-" / null / undefined values should always go to the bottom of the table
      const isAEmpty = aVal === "-" || aVal === "" || aVal === null || aVal === undefined;
      const isBEmpty = bVal === "-" || bVal === "" || bVal === null || bVal === undefined;
      
      if (isAEmpty && isBEmpty) return 0;
      if (isAEmpty) return 1;  // Put A at bottom
      if (isBEmpty) return -1; // Put B at bottom
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [filteredItems, sortConfig]);

  const requestSort = (key: keyof StatusMuatanItem) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSelisihColor = (val: number) => {
    if (val > 0) return "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20";
    if (val < 0) return "text-rose-600 dark:text-rose-400 font-bold bg-rose-50/50 dark:bg-rose-950/20";
    return "text-slate-500 dark:text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-900/40";
  };

  const getSortIcon = (key: keyof StatusMuatanItem) => {
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline-block text-slate-300 hover:text-white" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-orange-500" />
              Laporan Status Muatan Pendataan Lapangan SE2026
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Daftar Petugas PPL & PML diurutkan berdasarkan selisih usaha (Usaha Baru - Usaha Tidak Didata) secara menaik.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <a
              href="/Monev_Pendataan_SE2026_Latest.xlsx"
              download
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel Monev
            </a>
          </div>
        </div>

        {/* Legend / Keterangan Kolom */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-orange-500" />
            Keterangan Kolom Laporan
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Kel TD:</span> Keluarga Tidak Didata (Meninggal, Tidak Eligible, Tidak Dapat Ditemui, Tidak Ditemukan)
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Kel Baru:</span> Keluarga Baru yang ditemukan di lapangan
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Kel Selisih:</span> Selisih Keluarga (Kel Baru - Kel TD)
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Ush TD:</span> Usaha Tidak Didata (Tutup, Pindah, Tidak Eligible, dll)
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Ush Baru:</span> Usaha Baru yang ditemukan di lapangan
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Ush Selisih:</span> Selisih Usaha (Ush Baru - Ush TD)
            </div>
            <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Total TD / Baru / Selisih:</span> Akumulasi gabungan dari Keluarga dan Usaha
            </div>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Cari nama Petugas atau Kecamatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>
          
          {/* Kecamatan Filter */}
          <div className="w-full md:w-56 shrink-0">
            <select
              value={selectedKecamatan}
              onChange={(e) => setSelectedKecamatan(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="all">Semua Kecamatan</option>
              {uniqueKecamatans.map((kec) => (
                <option key={kec} value={kec}>{kec}</option>
              ))}
            </select>
          </div>

          {/* Jabatan Filter */}
          <div className="w-full md:w-48 shrink-0">
            <select
              value={selectedJabatan}
              onChange={(e) => setSelectedJabatan(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="all">Semua Jabatan</option>
              <option value="PCL">PCL</option>
              <option value="PML">PML</option>
            </select>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data muatan...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-800 dark:text-red-300 p-6">
            <p className="font-semibold text-base">Error Memuat Data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[650px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative">
            <table className="w-full text-left border-separate border-spacing-0 text-xs sm:text-sm">
              <thead>
                <tr className="bg-orange-500 text-white text-[11px] sm:text-xs">
                  {/* Frozen Header No */}
                  <th 
                    className="sticky left-0 top-0 z-30 bg-orange-500 px-3 py-3 font-bold text-center border-b border-r border-orange-600/30 select-none cursor-pointer hover:bg-orange-600 min-w-[48px] w-[48px]" 
                    onClick={() => requestSort("rank")}
                  >
                    No {getSortIcon("rank")}
                  </th>
                  {/* Frozen Header Nama */}
                  <th 
                    className="sticky left-[48px] top-0 z-30 bg-orange-500 px-4 py-3 font-bold border-b border-r border-orange-600/30 select-none cursor-pointer hover:bg-orange-600 min-w-[200px]" 
                    onClick={() => requestSort("nama")}
                  >
                    Nama Petugas {getSortIcon("nama")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("jabatan")}
                  >
                    Jabatan {getSortIcon("jabatan")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-3 py-3 font-bold border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600 min-w-[150px]" 
                    onClick={() => requestSort("kecamatan")}
                  >
                    Kecamatan {getSortIcon("kecamatan")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-l border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("kel_td")}
                  >
                    Kel TD {getSortIcon("kel_td")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("kel_b")}
                  >
                    Kel Baru {getSortIcon("kel_b")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("kel_sel")}
                  >
                    Kel Selisih {getSortIcon("kel_sel")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-l border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("ush_td")}
                  >
                    Ush TD {getSortIcon("ush_td")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("ush_b")}
                  >
                    Ush Baru {getSortIcon("ush_b")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("ush_sel")}
                  >
                    Ush Selisih {getSortIcon("ush_sel")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-l border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("tot_td")}
                  >
                    Total TD {getSortIcon("tot_td")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("tot_b")}
                  >
                    Total Baru {getSortIcon("tot_b")}
                  </th>
                  <th 
                    className="sticky top-0 z-20 bg-orange-500 px-2 py-3 font-bold text-center border-b border-orange-600/30 select-none cursor-pointer hover:bg-orange-600" 
                    onClick={() => requestSort("tot_sel")}
                  >
                    Total Selisih {getSortIcon("tot_sel")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sortedItems.map((item, idx) => (
                  <tr key={item.nama + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    {/* Frozen Cell No */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 text-center font-medium text-slate-500 dark:text-slate-400 px-3 py-2.5 border-b border-r border-slate-200 dark:border-slate-800 transition-colors">
                      {idx + 1}
                    </td>
                    {/* Frozen Cell Nama Petugas */}
                    <td className="sticky left-[48px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 font-semibold text-slate-900 dark:text-white px-4 py-2.5 border-b border-r border-slate-200 dark:border-slate-800 whitespace-nowrap transition-colors">
                      {item.nama}
                    </td>
                    <td className="px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        item.jabatan === "PML" 
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                      }`}>
                        {item.jabatan}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 transition-colors min-w-[150px]">
                      {item.kecamatan}
                    </td>
                    
                    <td className="px-2 py-2.5 text-center border-b border-l border-slate-200 dark:border-slate-800 transition-colors">{item.kel_td.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors">{item.kel_b.toLocaleString()}</td>
                    <td className={`px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors ${getSelisihColor(item.kel_sel)}`}>
                      {item.kel_sel > 0 ? `+${item.kel_sel}` : item.kel_sel}
                    </td>
                    
                    <td className="px-2 py-2.5 text-center border-b border-l border-slate-200 dark:border-slate-800 transition-colors">{item.ush_td.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors">{item.ush_b.toLocaleString()}</td>
                    <td className={`px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors ${getSelisihColor(item.ush_sel)}`}>
                      {item.ush_sel > 0 ? `+${item.ush_sel}` : item.ush_sel}
                    </td>
                    
                    <td className="px-2 py-2.5 text-center border-b border-l border-slate-200 dark:border-slate-800 transition-colors">{item.tot_td.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors">{item.tot_b.toLocaleString()}</td>
                    <td className={`px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-800 transition-colors ${getSelisihColor(item.tot_sel)}`}>
                      {item.tot_sel > 0 ? `+${item.tot_sel}` : item.tot_sel}
                    </td>
                  </tr>
                ))}
                {sortedItems.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400 border-b border-slate-200 dark:border-slate-800" colSpan={13}>
                      Tidak ada data petugas muatan ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
