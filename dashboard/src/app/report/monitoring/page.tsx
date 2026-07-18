"use client";

import React, { useState, useEffect } from "react";
import { Download, Search, RefreshCw, BarChart2, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";

interface KecamatanData {
  kecamatan: string;
  target: number;
  sls: number;
  open: number;
  draft: number;
  submitted: number;
  rejected: number;
  approved: number;
  revoke: number;
  realisasi: number;
  progres_harian: number;
  open_pct: number;
  draft_pct: number;
  submitted_pct: number;
  rejected_pct: number;
  approved_pct: number;
  revoke_pct: number;
  realisasi_pct: number;
  progres_harian_pct: number;
}

interface ReportData {
  date: string;
  time: string;
  kecamatan: KecamatanData[];
}

export default function MonitoringPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

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

  const filteredKecamatan = data
    ? data.kecamatan.filter((item) =>
        item.kecamatan.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Calculate totals
  const totalTarget = filteredKecamatan.reduce((acc, curr) => acc + curr.target, 0);
  const totalSls = filteredKecamatan.reduce((acc, curr) => acc + curr.sls, 0);
  const totalOpen = filteredKecamatan.reduce((acc, curr) => acc + curr.open, 0);
  const totalDraft = filteredKecamatan.reduce((acc, curr) => acc + curr.draft, 0);
  const totalSubmitted = filteredKecamatan.reduce((acc, curr) => acc + curr.submitted, 0);
  const totalRejected = filteredKecamatan.reduce((acc, curr) => acc + curr.rejected, 0);
  const totalApproved = filteredKecamatan.reduce((acc, curr) => acc + curr.approved, 0);
  const totalRevoke = filteredKecamatan.reduce((acc, curr) => acc + curr.revoke, 0);
  const totalRealisasi = filteredKecamatan.reduce((acc, curr) => acc + curr.realisasi, 0);
  const totalProgresHarian = filteredKecamatan.reduce((acc, curr) => acc + curr.progres_harian, 0);

  const formatPct = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
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
    
    const dailyTarget = 1.67;
    const cumulativeTarget = elapsedDays * dailyTarget;
    const diff = realisasiPct - cumulativeTarget;
    
    return {
      elapsedDays,
      cumulativeTarget,
      diff,
      isAboveTarget: diff >= 0,
      isBelowHalfTarget: realisasiPct < (0.5 * cumulativeTarget)
    };
  };

  const renderRealisasiCell = (pct: number) => {
    const pctVal = pct * 100;
    const targetInfo = calculateTargetAndDiff(pctVal);
    
    return (
      <div className="flex flex-col items-center gap-0.5 my-1">
        <span className={`inline-flex px-2 py-0.5 rounded-full font-extrabold text-[10px] sm:text-xs whitespace-nowrap ${
          targetInfo.isAboveTarget
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
            : targetInfo.isBelowHalfTarget
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
        }`}>
          {pctVal.toFixed(2)}%
        </span>
        <span className={`text-[9px] font-bold whitespace-nowrap ${
          targetInfo.isAboveTarget
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-orange-500" />
            Monitoring Evaluasi Progres Pendataan Lapangan
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Data dikelompokkan menurut Kecamatan di Kabupaten Kepulauan Sangihe.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <a
            href="/Report_Dashboard_Latest.xlsx"
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

      {/* Search & Statistics */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari Kecamatan..."
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
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Hijau</span>: Di atas target harian akumulatif (<span className="font-bold font-mono">&gt;= {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                </li>
                <li>
                  <span className="text-red-500 dark:text-red-400 font-extrabold">Merah</span>: Di bawah 50% target harian akumulatif (<span className="font-bold font-mono">&lt; {(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}%</span>).
                </li>
                <li>
                  <span className="text-amber-600 dark:text-amber-500 font-extrabold">Kuning</span>: Di antara 50% target s.d target harian akumulatif (<span className="font-bold font-mono">{(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}% s.d {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data laporan...</p>
        </div>
      ) : error ? (
        <div className="text-center py-10 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-800 dark:text-red-300 p-6">
          <p className="font-semibold text-base">Error Memuat Data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-orange-500 text-white border-b border-orange-600">
                <th className="px-4 py-3 font-semibold text-center align-middle" rowSpan={2}>No</th>
                <th className="px-4 py-3 font-semibold align-middle" rowSpan={2}>Kecamatan</th>
                <th className="px-4 py-3 font-semibold text-center align-middle" rowSpan={2}>Target</th>
                <th className="px-4 py-3 font-semibold text-center align-middle" rowSpan={2}>Jml SLS</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Open</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Draft</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Submitted</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Rejected</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Approved</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Revoke</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Realisasi</th>
                <th className="px-4 py-3 font-semibold text-center border-b border-orange-600/40" colSpan={2}>Progres Harian</th>
              </tr>
              <tr className="bg-orange-500 text-white">
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
                <th className="px-2 py-2 font-medium text-center">Jml</th>
                <th className="px-2 py-2 font-medium text-center">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredKecamatan.map((item, idx) => (
                <tr
                  key={item.kecamatan}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {item.kecamatan}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{item.target.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">{item.sls.toLocaleString()}</td>
                  
                  <td className="px-2 py-3 text-center">{item.open.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.open_pct)}</td>
                  
                  <td className="px-2 py-3 text-center">{item.draft.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.draft_pct)}</td>
                  
                  <td className="px-2 py-3 text-center">{item.submitted.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.submitted_pct)}</td>
                  
                  <td className="px-2 py-3 text-center">{item.rejected.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.rejected_pct)}</td>
                  
                  <td className="px-2 py-3 text-center">{item.approved.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.approved_pct)}</td>
                  
                  <td className="px-2 py-3 text-center">{item.revoke.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{formatPct(item.revoke_pct)}</td>
                  
                  <td className="px-2 py-3 text-center font-bold text-orange-600 dark:text-orange-400">{item.realisasi.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center">{renderRealisasiCell(item.realisasi_pct)}</td>
                  
                  <td className="px-2 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{item.progres_harian.toLocaleString()}</td>
                  <td className="px-2 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{formatPct(item.progres_harian_pct)}</td>
                </tr>
              ))}
              
              {/* Total Row */}
              <tr className="bg-orange-50 dark:bg-orange-950/20 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                <td className="px-4 py-4 text-center"></td>
                <td className="px-4 py-4">Kab. Kepl. Sangihe</td>
                <td className="px-4 py-4 text-center">{totalTarget.toLocaleString()}</td>
                <td className="px-4 py-4 text-center">{totalSls.toLocaleString()}</td>
                
                <td className="px-2 py-4 text-center">{totalOpen.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalOpen / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center">{totalDraft.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalDraft / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center">{totalSubmitted.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalSubmitted / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center">{totalRejected.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalRejected / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center">{totalApproved.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalApproved / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center">{totalRevoke.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{formatPct(totalTarget > 0 ? totalRevoke / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center text-orange-600 dark:text-orange-400">{totalRealisasi.toLocaleString()}</td>
                <td className="px-2 py-4 text-center">{renderRealisasiCell(totalTarget > 0 ? totalRealisasi / totalTarget : 0)}</td>
                
                <td className="px-2 py-4 text-center text-emerald-600 dark:text-emerald-400">{totalProgresHarian.toLocaleString()}</td>
                <td className="px-2 py-4 text-center text-emerald-600 dark:text-emerald-400">{formatPct(totalTarget > 0 ? totalProgresHarian / totalTarget : 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      </main>
    </div>
  );
}
