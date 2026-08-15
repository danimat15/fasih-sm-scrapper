"use client";

import React, { useState, useEffect } from "react";
import { Download, Search, RefreshCw, Award, ArrowUp, ArrowDown, Minus, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";

interface PPLData {
  nama: string;
  kecamatan: string;
  koseka: string;
  target: number;
  open: number;
  draft: number;
  submit: number;
  reject: number;
  approved: number;
  progres: number;
  realisasi: number;
  realisasi_pct: number;
}

interface PMLData {
  nama: string;
  kecamatan: string;
  koseka: string;
  target: number;
  open: number;
  draft: number;
  submit: number;
  reject: number;
  approved: number;
  revoke: number;
  realisasi: number;
  realisasi_pct: number;
}

interface KecLeaderboardData {
  kecamatan: string;
  realisasi_pct: number;
  rank: number;
  rank_change: number;
}

interface ReportData {
  date: string;
  time: string;
  ppl: PPLData[];
  pml: PMLData[];
  kec_leaderboard: KecLeaderboardData[];
}

export default function LeaderboardPage() {
  const [reportType, setReportType] = useState<"pagi" | "sore">("pagi");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ppl" | "pml" | "kec">("ppl");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const fetchData = async (type?: "pagi" | "sore") => {
    setLoading(true);
    const targetType = type || reportType;
    try {
      const filename = type 
        ? (type === "pagi" ? "/report_data_morning.json" : "/report_data_evening.json")
        : "/report_data.json";
        
      let res = await fetch(filename);
      if (!res.ok && type) {
        res = await fetch("/report_data.json");
      }
      if (!res.ok) {
        throw new Error("Gagal memuat data laporan.");
      }
      const jsonData = await res.json();
      setData(jsonData);
      setError(null);
      
      if (!type && jsonData.report_type) {
        setReportType(jsonData.report_type);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportTypeChange = (type: "pagi" | "sore") => {
    setReportType(type);
    fetchData(type);
  };

  const formatPct = (val: number) => {
    return `${val.toFixed(2)}%`;
  };

  const calculateTargetAndDiff = (realisasiPct: number) => {
    const startDate = new Date("2026-06-15");
    const today = new Date();
    
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    let elapsedDays = diffDays;
    if (today.getHours() < 12) {
      elapsedDays = diffDays - 1;
    }
    elapsedDays = Math.max(0, elapsedDays);
    
    const dailyTarget = 100.0 / 60.0;
    const cumulativeTarget = Math.min(100.0, elapsedDays * dailyTarget);
    const diff = realisasiPct - cumulativeTarget;
    
    const is100Pct = realisasiPct >= 100;
    
    return {
      elapsedDays,
      dailyTarget,
      cumulativeTarget,
      diff,
      is100Pct,
      isAboveTarget: !is100Pct && diff >= 0,
      isBelowHalfTarget: !is100Pct && realisasiPct < (0.5 * cumulativeTarget)
    };
  };

  const renderRealisasiCell = (pctVal: number) => {
    const targetInfo = calculateTargetAndDiff(pctVal);
    
    return (
      <div className="flex flex-col items-center gap-0.5 my-1">
        <span className={`inline-flex px-2 py-0.5 rounded-full font-extrabold text-[10px] sm:text-xs whitespace-nowrap ${
          targetInfo.is100Pct
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
            : targetInfo.isAboveTarget
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
            : targetInfo.isBelowHalfTarget
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
        }`}>
          {pctVal.toFixed(2)}%
        </span>
        <span className={`text-[9px] font-bold whitespace-nowrap ${
          targetInfo.is100Pct
            ? "text-blue-600 dark:text-blue-400"
            : targetInfo.isAboveTarget
            ? "text-emerald-600 dark:text-emerald-450"
            : targetInfo.isBelowHalfTarget
            ? "text-rose-500 dark:text-rose-405"
            : "text-amber-600 dark:text-amber-500"
        }`}>
          {targetInfo.diff >= 0 
            ? `+${targetInfo.diff.toFixed(2)}%` 
            : `${targetInfo.diff.toFixed(2)}%`}
        </span>
      </div>
    );
  };

  const bannerTargetInfo = calculateTargetAndDiff(0);

  // Get Top 10 and Bottom 10 PPL
  const getPplHighest = () => {
    if (!data) return [];
    const sorted = [...data.ppl].sort((a, b) => b.realisasi_pct - a.realisasi_pct);
    return sorted.filter((item) =>
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getPplLowest = () => {
    if (!data) return [];
    const sorted = [...data.ppl].sort((a, b) => a.realisasi_pct - b.realisasi_pct);
    return sorted.filter((item) =>
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredPml = () => {
    if (!data) return [];
    const sorted = [...data.pml].sort((a, b) => b.realisasi_pct - a.realisasi_pct);
    return sorted.filter((item) =>
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredKec = () => {
    if (!data) return [];
    const sorted = [...data.kec_leaderboard].sort((a, b) => b.realisasi_pct - a.realisasi_pct);
    return sorted.filter((item) =>
      item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const pplHighest = getPplHighest().slice(0, 10);
  const pplLowest = getPplLowest().slice(0, 10);
  const pmlList = getFilteredPml();
  const kecList = getFilteredKec();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-orange-500" />
            Leaderboard Progres Pendataan SE2026
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Peringkat pencapaian target pendataan lapangan PPL, PML, dan Kecamatan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Pagi / Sore */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => handleReportTypeChange("pagi")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === "pagi"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Laporan Pagi (vs Pagi H-1)
            </button>
            <button
              onClick={() => handleReportTypeChange("sore")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === "sore"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Laporan Sore (vs Pagi H-0)
            </button>
          </div>

          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <a
            href={reportType === "pagi" ? "/Report_Dashboard_Morning.xlsx" : "/Report_Dashboard_Evening.xlsx"}
            download
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Excel
          </a>
        </div>
      </div>

      {/* Info Card */}
      {data && (
        <div className="mb-6 p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/50 dark:border-orange-900/30 flex flex-wrap gap-x-6 gap-y-2 text-xs text-orange-800 dark:text-orange-300">
          <div>
            <span className="font-semibold">Hari/Tanggal:</span> {data.date}
          </div>
          <div>
            <span className="font-semibold">Pukul:</span> {data.time}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        <button
          onClick={() => {
            setActiveTab("ppl");
            setSearchTerm("");
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all px-4 ${
            activeTab === "ppl"
              ? "border-orange-500 text-orange-500"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Leaderboard PPL (Top & Bottom 10)
        </button>
        <button
          onClick={() => {
            setActiveTab("pml");
            setSearchTerm("");
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all px-4 ${
            activeTab === "pml"
              ? "border-orange-500 text-orange-500"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Leaderboard PML
        </button>
        <button
          onClick={() => {
            setActiveTab("kec");
            setSearchTerm("");
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all px-4 ${
            activeTab === "kec"
              ? "border-orange-500 text-orange-500"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Leaderboard Kecamatan
        </button>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder={
              activeTab === "kec"
                ? "Cari Kecamatan..."
                : "Cari Nama atau Kecamatan..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Warning Banner Info */}
      <div className="mb-6 p-4 rounded-xl border bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex gap-2.5 items-start">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200">Ketentuan Pewarnaan & Target Harian Akumulatif:</span>
          <ul className="list-disc list-inside mt-1 flex flex-col gap-1 text-slate-600 dark:text-slate-300">
            <li>
              Target Harian: <span className="font-bold text-slate-800 dark:text-slate-200">1,67%</span> per hari | Dimulai: <span className="font-bold text-slate-800 dark:text-slate-200">15 Juni 2026</span> | Hari ke-<span className="font-bold text-slate-800 dark:text-slate-200">{bannerTargetInfo.elapsedDays}</span> (Target Akumulatif: <span className="font-bold text-slate-800 dark:text-slate-200">{bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
            </li>
            <li>
              Aturan Pewarnaan Realisasi (%):
              <ul className="list-disc list-inside pl-5 mt-0.5 flex flex-col gap-0.5">
                <li>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold">Biru</span>: Realisasi tuntas (<span className="font-bold font-mono">&gt;= 100,00%</span>).
                </li>
                <li>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Hijau</span>: Di atas target harian akumulatif (<span className="font-bold font-mono">&gt;= {bannerTargetInfo.cumulativeTarget.toFixed(2)}% s.d &lt; 100,00%</span>).
                </li>
                <li>
                  <span className="text-red-500 dark:text-red-400 font-extrabold">Merah</span>: Di bawah 50% target harian akumulatif (<span className="font-bold font-mono">&lt; {(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}%</span>).
                </li>
                <li>
                  <span className="text-amber-600 dark:text-amber-500 font-extrabold">Kuning</span>: Di antara 50% target s.d target harian akumulatif (<span className="font-bold font-mono">{(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}% s.d &lt; {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* Leaderboard Tables */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat leaderboard...</p>
        </div>
      ) : error ? (
        <div className="text-center py-10 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-800 dark:text-red-300 p-6">
          <p className="font-semibold text-base">Error Memuat Data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : activeTab === "ppl" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top 10 PPL */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ↑
              </span>
              Top 10 PPL Tercepat
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <th className="px-4 py-3 text-center">Rank</th>
                    <th className="px-4 py-3">Nama PPL</th>
                    <th className="px-4 py-3">Kecamatan</th>
                    <th className="px-4 py-3 text-center">Target</th>
                    <th className="px-4 py-3 text-center">Realisasi</th>
                    <th className="px-4 py-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {pplHighest.map((item, idx) => (
                    <tr key={item.nama + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.nama}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.kecamatan}</td>
                      <td className="px-4 py-3 text-center">{item.target.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{item.realisasi.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">{renderRealisasiCell(item.realisasi_pct)}</td>
                    </tr>
                  ))}
                  {pplHighest.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>Tidak ada data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom 10 PPL */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40 text-xs font-bold text-rose-600 dark:text-rose-400">
                ↓
              </span>
              Bottom 10 PPL Lambat
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <th className="px-4 py-3 text-center">Rank</th>
                    <th className="px-4 py-3">Nama PPL</th>
                    <th className="px-4 py-3">Kecamatan</th>
                    <th className="px-4 py-3 text-center">Target</th>
                    <th className="px-4 py-3 text-center">Realisasi</th>
                    <th className="px-4 py-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {pplLowest.map((item, idx) => (
                    <tr key={item.nama + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-center font-bold text-rose-600 dark:text-rose-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.nama}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.kecamatan}</td>
                      <td className="px-4 py-3 text-center">{item.target.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{item.realisasi.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">{renderRealisasiCell(item.realisasi_pct)}</td>
                    </tr>
                  ))}
                  {pplLowest.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>Tidak ada data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "pml" ? (
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4">
            Leaderboard PML
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <th className="px-4 py-3 text-center">Rank</th>
                  <th className="px-4 py-3">Nama PML</th>
                  <th className="px-4 py-3">Kecamatan</th>
                  <th className="px-4 py-3">Koseka</th>
                  <th className="px-4 py-3 text-center">Target</th>
                  <th className="px-4 py-3 text-center">Open</th>
                  <th className="px-4 py-3 text-center">Draft</th>
                  <th className="px-4 py-3 text-center">Submit</th>
                  <th className="px-4 py-3 text-center">Reject</th>
                  <th className="px-4 py-3 text-center">Approved</th>
                  <th className="px-4 py-3 text-center">Revoke</th>
                  <th className="px-4 py-3 text-center">Realisasi</th>
                  <th className="px-4 py-3 text-center">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {pmlList.map((item, idx) => (
                  <tr key={item.nama + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.nama}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.kecamatan}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.koseka}</td>
                    <td className="px-4 py-3 text-center">{item.target.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.open.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.draft.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.submit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.reject.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.approved.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{item.revoke.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{item.realisasi.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{renderRealisasiCell(item.realisasi_pct)}</td>
                  </tr>
                ))}
                {pmlList.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={13}>Tidak ada data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4">
            Leaderboard Kecamatan
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <th className="px-6 py-3 text-center">Rank</th>
                  <th className="px-6 py-3">Kecamatan</th>
                  <th className="px-6 py-3 text-center">Progres (%)</th>
                  <th className="px-6 py-3 text-center">Rank Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {kecList.map((item) => {
                  const change = item.rank_change;
                  const isUp = change > 0;
                  const isDown = change < 0;
                  return (
                    <tr key={item.kecamatan} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                        {item.rank}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">{item.kecamatan}</td>
                      <td className="px-6 py-3.5 text-center">
                        {renderRealisasiCell(item.realisasi_pct)}
                      </td>
                      <td className="px-6 py-3.5 text-center flex items-center justify-center">
                        <div
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isUp
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : isDown
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {isUp ? (
                            <ArrowUp className="w-3.5 h-3.5" />
                          ) : isDown ? (
                            <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          {isUp ? `+${change}` : change}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {kecList.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-slate-400" colSpan={4}>Tidak ada data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
