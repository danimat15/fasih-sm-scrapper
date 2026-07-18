"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Moon,
  Sun,
  RefreshCw,
  Download,
  ChevronDown,
  Search,
  BarChart3,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface SBRRow {
  kode: string;
  UB: number;
  UM: number;
  UMK: number;
  Total: number;
}

interface SBRData {
  kab: SBRRow[];
  kec: SBRRow[];
  desa: SBRRow[];
  sls: SBRRow[];
  sub_sls: SBRRow[];
}

interface ScrapedTabulasi {
  kode: string;
  UB: number;
  UM: number;
  UMK: number;
  Total: number;
  fasih_Target: number;
  fasih_Realisasi: number;
}

interface ComparisonRow {
  kode: string;
  // SBR
  sbr_UB: number;
  sbr_UM: number;
  sbr_UMK: number;
  sbr_Total: number;
  // Scraping
  scr_UB: number;
  scr_UM: number;
  scr_UMK: number;
  scr_Total: number;
  // Diff (scraping - SBR) for common cols
  diff_UB: number;
  diff_UM: number;
  diff_UMK: number;
  diff_Total: number;
  // Realisasi Petugas
  fasih_Target: number;
  fasih_Realisasi: number;
  fasih_Pct: number;
}

type LevelKey = "kab" | "kec" | "desa" | "sls" | "sub_sls";

const LEVEL_LABELS: Record<LevelKey, string> = {
  kab: "Kabupaten",
  kec: "Kecamatan",
  desa: "Desa/Kelurahan",
  sls: "SLS",
  sub_sls: "Sub SLS",
};

const CODE_LENGTHS: Record<LevelKey, number> = {
  kab: 4,
  kec: 7,
  desa: 10,
  sls: 14,
  sub_sls: 16,
};

// ─── Helpers ─────────────────────────────────────────────────

const formatKecName = (name: string): string => {
  if (!name) return "";
  let cleaned = name.replace(/\(\d+\)/g, "").trim();
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const normalizeKec = (name: string): string => {
  if (!name) return "";
  return name.replace(/\(\d+\)/g, "").trim().toUpperCase();
};

// ─── Main Page ──────────────────────────────────────────────

export default function ComparisonSBRPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Data
  const [sbrData, setSbrData] = useState<SBRData | null>(null);
  const [kosekaNames, setKosekaNames] = useState<Record<string, string>>({});
  const [rawCsvData, setRawCsvData] = useState<
    { idCode: string; scale: string; status: string; nama_kec: string; jumlahUsaha: number }[]
  >([]);

  // Filters
  const [activeLevel, setActiveLevel] = useState<LevelKey>("kab");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) Fetch SBR JSON
      const sbrResponse = await fetch("/sbr_data.json");
      if (!sbrResponse.ok) throw new Error("Gagal mengambil sbr_data.json.");
      const sbrJson: SBRData = await sbrResponse.json();
      setSbrData(sbrJson);

      // 2) Fetch koseka.csv for subdistrict names mapping
      let kosekaMap: Record<string, string> = {};
      try {
        const kosekaResponse = await fetch("/koseka.csv");
        if (kosekaResponse.ok) {
          const kosekaText = await kosekaResponse.text();
          const kosekaLines = kosekaText.split("\n");
          for (let i = 1; i < kosekaLines.length; i++) {
            const line = kosekaLines[i].trim();
            if (!line) continue;
            const parts = line.split(";");
            if (parts.length >= 2) {
              const code = parts[0].trim();
              const name = parts[1].trim();
              kosekaMap[code] = name;
            }
          }
        }
      } catch (err) {
        console.error("Gagal memuat koseka.csv:", err);
      }
      setKosekaNames(kosekaMap);

      // 3) Fetch update_data.csv for scraping data
      const dataResponse = await fetch("/update_data.csv");
      if (!dataResponse.ok)
        throw new Error("Gagal mengambil file update_data.csv.");
      const dataText = await dataResponse.text();

      const lines = dataText.split("\n");
      const parsed: { idCode: string; scale: string; status: string; nama_kec: string; jumlahUsaha: number }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row: string[] = [];
        let insideQuote = false;
        let entry = "";

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === "," && !insideQuote) {
            row.push(entry);
            entry = "";
          } else {
            entry += char;
          }
        }
        row.push(entry);

        if (
          row.length >= 17 &&
          row[1] &&
          row[1].trim() !== "" &&
          row[1] !== "Kode Identitas"
        ) {
          const juStr = row[8] ? row[8].replace(/"/g, "").trim() : "";
          const jVal = juStr === "-" || !juStr ? 0 : (parseInt(juStr, 10) || 0);

          parsed.push({
            idCode: row[1].replace(/"/g, "").trim(),
            scale: row[7].replace(/"/g, "").trim(),
            status: row[12] ? row[12].replace(/"/g, "").trim() : "",
            nama_kec: row[17] ? row[17].replace(/"/g, "").trim() : "",
            jumlahUsaha: jVal,
          });
        }
      }

      setRawCsvData(parsed);

      // Timestamp
      let loadedTimestamp = "";
      try {
        const timeResponse = await fetch("/last_updated.txt");
        if (timeResponse.ok) {
          loadedTimestamp = (await timeResponse.text()).trim();
        }
      } catch {
        // fallback
      }
      if (loadedTimestamp) {
        setLastUpdated(loadedTimestamp);
      } else {
        const now = new Date();
        setLastUpdated(
          now.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " WITA"
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      console.error(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Build scraped tabulasi per level ──────────────────────

  const scrapedTabulasi = useMemo(() => {
    const result: Record<LevelKey, Record<string, ScrapedTabulasi>> = {
      kab: {},
      kec: {},
      desa: {},
      sls: {},
      sub_sls: {},
    };

    rawCsvData.forEach((r) => {
      // Extract the leading numeric code from idCode
      const codeMatch = r.idCode.match(/^(\d+)/);
      if (!codeMatch) return;
      const fullCode = codeMatch[1];
      if (fullCode.length < 4) return;

      // Pad to 16 chars with X for missing digits
      const padded = fullCode.padEnd(16, "X");

      const levels: LevelKey[] = ["kab", "kec", "desa", "sls", "sub_sls"];

      levels.forEach((lvl) => {
        const codeLen = CODE_LENGTHS[lvl];
        const code = padded.substring(0, codeLen);
        // Skip if code contains X (insufficient digits)
        if (code.includes("X")) return;

        if (!result[lvl][code]) {
          result[lvl][code] = {
            kode: code,
            UB: 0,
            UM: 0,
            UMK: 0,
            Total: 0,
            fasih_Target: 0,
            fasih_Realisasi: 0,
          };
        }

        const entry = result[lvl][code];
        const s = r.scale.toUpperCase().trim();
        const status = r.status ? r.status.toLowerCase().trim() : "";

        const isFocusedStatus =
          status === "submitted by pencacah" || status === "submit" || status === "submitted" || status === "submitted respondent" ||
          status === "approved by pengawas" || status === "approve" || status === "approved" || status === "completed by admin kabupaten" || status === "edited by admin kabupaten" ||
          status === "rejected by pengawas" || status === "reject" || status === "rejected" || status === "rejected by admin kabupaten" ||
          status === "revoked by pengawas" || status === "revoke" || status === "revoked";

        // Increment target prelist count
        entry.fasih_Target += 1;

        if (isFocusedStatus) {
          // Increment realisasi prelist count
          entry.fasih_Realisasi += 1;

          if (s === "UB") {
            entry.UB += r.jumlahUsaha;
          } else if (s === "UM") {
            entry.UM += r.jumlahUsaha;
          } else if (s === "UMK" || s.includes("UMK")) {
            entry.UMK += r.jumlahUsaha;
          }
        }

        entry.Total = entry.UB + entry.UM + entry.UMK;
      });
    });

    return result;
  }, [rawCsvData]);

  // ─── Build comparison rows ─────────────────────────────────

  const comparisonRows = useMemo((): ComparisonRow[] => {
    if (!sbrData) return [];

    const sbrLevel = sbrData[activeLevel] || [];
    const scraped = scrapedTabulasi[activeLevel] || {};

    // Build SBR map
    const sbrMap: Record<string, SBRRow> = {};
    sbrLevel.forEach((row) => {
      sbrMap[String(row.kode)] = row;
    });

    // Merge all codes
    const allCodes = new Set<string>([
      ...Object.keys(sbrMap),
      ...Object.keys(scraped),
    ]);

    const rows: ComparisonRow[] = [];
    allCodes.forEach((kode) => {
      // Filter out non-numeric codes (like "WILMAR", etc)
      if (!/^\d+$/.test(kode)) return;

      const sbr = sbrMap[kode];
      const scr = scraped[kode];

      const sbr_UB = sbr?.UB || 0;
      const sbr_UM = sbr?.UM || 0;
      const sbr_UMK = sbr?.UMK || 0;
      const sbr_Total = sbr?.Total || 0;

      const scr_UB = scr?.UB || 0;
      const scr_UM = scr?.UM || 0;
      const scr_UMK = scr?.UMK || 0;
      const scr_Total = scr?.Total || 0;

      const fasih_Target = scr?.fasih_Target || 0;
      const fasih_Realisasi = scr?.fasih_Realisasi || 0;
      const fasih_Pct = fasih_Target > 0 ? (fasih_Realisasi / fasih_Target) * 100 : 0;

      rows.push({
        kode,
        sbr_UB,
        sbr_UM,
        sbr_UMK,
        sbr_Total,
        scr_UB,
        scr_UM,
        scr_UMK,
        scr_Total,
        diff_UB: scr_UB - sbr_UB,
        diff_UM: scr_UM - sbr_UM,
        diff_UMK: scr_UMK - sbr_UMK,
        diff_Total: scr_Total - sbr_Total,
        fasih_Target,
        fasih_Realisasi,
        fasih_Pct,
      });
    });

    return rows.sort((a, b) => a.kode.localeCompare(b.kode));
  }, [sbrData, scrapedTabulasi, activeLevel]);

  // Filtered
  const filteredRows = useMemo(() => {
    if (!searchQuery) return comparisonRows;
    const q = searchQuery.toLowerCase();
    return comparisonRows.filter((r) => {
      const kodeMatch = r.kode.includes(q);
      let nameMatch = false;
      if (activeLevel === "kab" && r.kode === "7103") {
        nameMatch = "kepulauan sangihe".includes(q);
      } else if (activeLevel === "kec" && kosekaNames[r.kode]) {
        nameMatch = kosekaNames[r.kode].toLowerCase().includes(q);
      }
      return kodeMatch || nameMatch;
    });
  }, [comparisonRows, searchQuery, activeLevel, kosekaNames]);

  // Paginated
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeLevel, searchQuery]);

  // ─── Summary Totals ────────────────────────────────────────

  const summaryTotals = useMemo(() => {
    let sbr_UB = 0,
      sbr_UM = 0,
      sbr_UMK = 0,
      sbr_Total = 0;
    let scr_UB = 0,
      scr_UM = 0,
      scr_UMK = 0,
      scr_Total = 0;
    let fasih_Target = 0,
      fasih_Realisasi = 0;

    comparisonRows.forEach((r) => {
      sbr_UB += r.sbr_UB;
      sbr_UM += r.sbr_UM;
      sbr_UMK += r.sbr_UMK;
      sbr_Total += r.sbr_Total;
      scr_UB += r.scr_UB;
      scr_UM += r.scr_UM;
      scr_UMK += r.scr_UMK;
      scr_Total += r.scr_Total;
      fasih_Target += r.fasih_Target;
      fasih_Realisasi += r.fasih_Realisasi;
    });

    return {
      sbr_UB,
      sbr_UM,
      sbr_UMK,
      sbr_Total,
      scr_UB,
      scr_UM,
      scr_UMK,
      scr_Total,
      diff_UB: scr_UB - sbr_UB,
      diff_UM: scr_UM - sbr_UM,
      diff_UMK: scr_UMK - sbr_UMK,
      diff_Total: scr_Total - sbr_Total,
      fasih_Target,
      fasih_Realisasi,
      fasih_Pct: fasih_Target > 0 ? (fasih_Realisasi / fasih_Target) * 100 : 0,
    };
  }, [comparisonRows]);

  // ─── CSV Export ────────────────────────────────────────────

  const handleExportCSV = () => {
    const headers = [
      "Kode",
      "Nama Wilayah",
      "SBR_UB",
      "SBR_UM",
      "SBR_UMK",
      "SBR_Total",
      "FasihSM_UB",
      "FasihSM_UM",
      "FasihSM_UMK",
      "FasihSM_Total",
      "FasihSM_Target_Petugas",
      "FasihSM_Realisasi_Petugas",
      "FasihSM_Persentase_Petugas",
      "Selisih_UB",
      "Selisih_UM",
      "Selisih_UMK",
      "Selisih_Total",
    ];
    const rows = filteredRows.map((r) => {
      let namaWilayah = "";
      if (activeLevel === "kab" && r.kode === "7103") {
        namaWilayah = "Kabupaten Kepulauan Sangihe";
      } else if (activeLevel === "kec" && kosekaNames[r.kode]) {
        namaWilayah = formatKecName(kosekaNames[r.kode]);
      }
      return [
        r.kode,
        `"${namaWilayah.replace(/"/g, '""')}"`,
        r.sbr_UB,
        r.sbr_UM,
        r.sbr_UMK,
        r.sbr_Total,
        r.scr_UB,
        r.scr_UM,
        r.scr_UMK,
        r.scr_Total,
        r.fasih_Target,
        r.fasih_Realisasi,
        r.fasih_Pct.toFixed(2) + "%",
        r.diff_UB,
        r.diff_UM,
        r.diff_UMK,
        r.diff_Total,
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comparison_sbr_${activeLevel}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Diff Badge ────────────────────────────────────────────

  const DiffBadge = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
          <TrendingUp className="w-3 h-3" />+{value.toLocaleString("id-ID")}
        </span>
      );
    } else if (value < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400 font-semibold text-xs">
          <TrendingDown className="w-3 h-3" />
          {value.toLocaleString("id-ID")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500 font-medium text-xs">
        <Minus className="w-3 h-3" />0
      </span>
    );
  };

  const ProgressCell = ({ diff, scr, sbr }: { diff: number; scr: number; sbr: number }) => {
    const pct = sbr === 0 ? (scr > 0 ? 100 : 0) : Math.min(100, (scr / sbr) * 100);
    const displayPct = sbr === 0 ? (scr > 0 ? "100.00%" : "0.00%") : ((scr / sbr) * 100).toFixed(2) + "%";

    // Progress bar color based on percentage
    let barColor = "bg-orange-500";
    if (pct >= 100) {
      barColor = "bg-emerald-500";
    } else if (pct > 50) {
      barColor = "bg-amber-500";
    }

    return (
      <div className="flex flex-col items-center justify-center gap-1 min-w-[70px]">
        <DiffBadge value={diff} />
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
          {displayPct}
        </span>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-0.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };



  return (
    <div
      className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300"
    >
      <Navbar />

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-5 sm:p-10 text-white shadow-xl shadow-orange-600/10 mb-8">
          <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-20 -translate-y-20"></div>
          <div className="absolute right-1/4 bottom-0 w-60 h-60 rounded-full bg-orange-400/20 blur-2xl translate-y-20"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/20 text-white mb-2 inline-block">
                Comparison × SBR
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                Perbandingan Data Fasih SM vs SBR
              </h2>
              <p className="text-xs sm:text-base md:text-lg text-orange-100 max-w-2xl font-light">
                Membandingkan hasil tabulasi data hasil pendataan FASIH dengan data
                Sensus Basis Register (SBR) per level wilayah.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 flex flex-col items-start md:items-end border border-white/10 text-left md:text-right">
                <span className="text-[10px] sm:text-xs text-orange-200">
                  Terakhir Diperbarui
                </span>
                <span className="text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0"></span>
                  <span className="truncate">{loading ? "Menyinkronkan..." : lastUpdated || "Belum ada data"}</span>
                </span>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white p-4 rounded-2xl transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && rawCsvData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-orange-200 dark:border-orange-900"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Memuat data perbandingan...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-20 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 mb-4">
              <BarChart3 className="w-8 h-8" />
            </div>
            <p className="text-red-600 dark:text-red-400 font-semibold">
              {error}
            </p>
          </div>
        ) : (
          <>
             {/* Summary Cards */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
               <div className="rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                 <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                   Total SBR
                 </p>
                 <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">
                   {summaryTotals.sbr_Total.toLocaleString("id-ID")}
                 </p>
                 <p className="text-[10px] text-slate-400 mt-1">
                   UB:{summaryTotals.sbr_UB} · UM:{summaryTotals.sbr_UM} · UMK:
                   {summaryTotals.sbr_UMK}
                 </p>
               </div>
               <div className="rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                 <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                   Total Fasih SM (UB+UM+UMK)
                 </p>
                 <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">
                   {summaryTotals.scr_Total.toLocaleString("id-ID")}
                 </p>
                 <p className="text-[10px] text-slate-400 mt-1">
                   UB:{summaryTotals.scr_UB} · UM:{summaryTotals.scr_UM} · UMK:
                   {summaryTotals.scr_UMK}
                 </p>
               </div>
               <div className="rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                 <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                   Selisih Total
                 </p>
                 <p className="text-lg sm:text-xl md:text-2xl font-bold">
                   <DiffBadge value={summaryTotals.diff_Total} />
                 </p>
                 <p className="text-[10px] text-slate-400 mt-1">
                   Fasih SM − SBR
                 </p>
               </div>
               <div className="rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                 <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                   Jumlah Wilayah
                 </p>
                 <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">
                   {filteredRows.length.toLocaleString("id-ID")}
                 </p>
                 <p className="text-[10px] text-slate-400 mt-1">
                   Level: {LEVEL_LABELS[activeLevel]}
                 </p>
               </div>
             </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
              {/* Level Tabs */}
              <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50 dark:bg-slate-900 overflow-x-auto scrollbar-none flex-nowrap min-w-0 w-full md:w-auto shrink-0">
                {(
                  Object.entries(LEVEL_LABELS) as [LevelKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveLevel(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      activeLevel === key
                        ? "bg-orange-500 text-white shadow-sm font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari kode atau nama wilayah..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Export */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm md:ml-auto w-full md:w-auto justify-center"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {/* Comparison Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1250px]">
                  <thead>
                    {/* Group headers */}
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th
                        rowSpan={2}
                        className="sticky left-0 top-0 z-30 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      >
                        Kode
                      </th>
                      <th
                        colSpan={4}
                        className="px-4 py-2 text-center font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border-r border-slate-200 dark:border-slate-700"
                      >
                        📋 Data SBR
                      </th>
                      <th
                        colSpan={4}
                        className="px-4 py-2 text-center font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border-r border-slate-200 dark:border-slate-700"
                      >
                        🔍 Data Fasih SM (UB, UM, UMK)
                      </th>
                      <th
                        colSpan={3}
                        className="px-4 py-2 text-center font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/10 border-r border-slate-200 dark:border-slate-700"
                      >
                        ⚡ Progres Realisasi Petugas
                      </th>
                      <th
                        colSpan={4}
                        className="px-4 py-2 text-center font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      >
                        📊 Selisih dan Progres (Fasih SM − SBR)
                      </th>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      {/* SBR */}
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UB
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UM
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UMK
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">
                        Total
                      </th>
                      {/* Scraping / Fasih SM */}
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UB
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UM
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        UMK
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">
                        Total
                      </th>
                      {/* Realisasi Petugas */}
                      <th className="px-3 py-2 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        Target
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        Realisasi
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">
                        %
                      </th>
                      {/* Diff */}
                      <th className="px-3 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        UB
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        UM
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        UMK
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={16}
                          className="text-center py-12 text-slate-400"
                        >
                          <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>Tidak ada data ditemukan.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, idx) => (
                        <tr
                          key={row.kode}
                          className={`group border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                            idx % 2 === 0
                              ? ""
                              : "bg-slate-25 dark:bg-slate-900/30"
                          }`}
                        >
                          <td className={`sticky left-0 z-10 px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] transition-colors ${
                            idx % 2 === 0
                              ? "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                              : "bg-slate-25 dark:bg-slate-900/40 group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                          }`}>
                            <div className="flex flex-col">
                              <span>{row.kode}</span>
                              {activeLevel === "kab" && row.kode === "7103" && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                  Kab. Kepulauan Sangihe
                                </span>
                              )}
                              {activeLevel === "kec" && kosekaNames[row.kode] && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                  {formatKecName(kosekaNames[row.kode])}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* SBR */}
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.sbr_UB.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.sbr_UM.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.sbr_UMK.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-orange-700 dark:text-orange-300 border-r border-slate-100 dark:border-slate-800">
                            {row.sbr_Total.toLocaleString("id-ID")}
                          </td>
                          {/* Scraping */}
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.scr_UB.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.scr_UM.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.scr_UMK.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-orange-700 dark:text-orange-300 border-r border-slate-100 dark:border-slate-800">
                            {row.scr_Total.toLocaleString("id-ID")}
                          </td>
                          {/* Realisasi Petugas */}
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.fasih_Target.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">
                            {row.fasih_Realisasi.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                            {row.fasih_Pct.toFixed(2)}%
                          </td>
                          {/* Diff */}
                          <td className="px-3 py-2.5">
                            <ProgressCell diff={row.diff_UB} scr={row.scr_UB} sbr={row.sbr_UB} />
                          </td>
                          <td className="px-3 py-2.5">
                            <ProgressCell diff={row.diff_UM} scr={row.scr_UM} sbr={row.sbr_UM} />
                          </td>
                          <td className="px-3 py-2.5">
                            <ProgressCell diff={row.diff_UMK} scr={row.scr_UMK} sbr={row.sbr_UMK} />
                          </td>
                          <td className="px-3 py-2.5">
                            <ProgressCell diff={row.diff_Total} scr={row.scr_Total} sbr={row.sbr_Total} />
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Totals row */}
                    {paginatedRows.length > 0 && (
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                        <td className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                          TOTAL
                        </td>
                        {/* SBR */}
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.sbr_UB.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.sbr_UM.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.sbr_UMK.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300 border-r border-slate-200 dark:border-slate-700">
                          {summaryTotals.sbr_Total.toLocaleString("id-ID")}
                        </td>
                        {/* Scraping */}
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.scr_UB.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.scr_UM.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">
                          {summaryTotals.scr_UMK.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300 border-r border-slate-200 dark:border-slate-700">
                          {summaryTotals.scr_Total.toLocaleString("id-ID")}
                        </td>
                        {/* Realisasi Petugas */}
                        <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                          {summaryTotals.fasih_Target.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                          {summaryTotals.fasih_Realisasi.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-center text-blue-700 dark:text-blue-300 border-r border-slate-200 dark:border-slate-700">
                          {summaryTotals.fasih_Pct.toFixed(2)}%
                        </td>
                        {/* Diff */}
                        <td className="px-3 py-3">
                          <ProgressCell diff={summaryTotals.diff_UB} scr={summaryTotals.scr_UB} sbr={summaryTotals.sbr_UB} />
                        </td>
                        <td className="px-3 py-3">
                          <ProgressCell diff={summaryTotals.diff_UM} scr={summaryTotals.scr_UM} sbr={summaryTotals.sbr_UM} />
                        </td>
                        <td className="px-3 py-3">
                          <ProgressCell diff={summaryTotals.diff_UMK} scr={summaryTotals.scr_UMK} sbr={summaryTotals.sbr_UMK} />
                        </td>
                        <td className="px-3 py-3">
                          <ProgressCell diff={summaryTotals.diff_Total} scr={summaryTotals.scr_Total} sbr={summaryTotals.sbr_Total} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Halaman {currentPage} dari {totalPages} (
                    {filteredRows.length} baris)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from(
                      { length: Math.min(5, totalPages) },
                      (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              currentPage === page
                                ? "bg-orange-500 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      }
                    )}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">
                Keterangan Kolom
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <p className="font-bold text-orange-600 dark:text-orange-400 mb-1">
                    📋 Data SBR
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc">
                    <li>
                      <b>UB</b> – Usaha Besar
                    </li>
                    <li>
                      <b>UM</b> – Usaha Menengah
                    </li>
                    <li>
                      <b>UMK</b> – Usaha Mikro Kecil
                    </li>
                    <li>
                      <b>Total</b> – UB + UM + UMK
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-orange-600 dark:text-orange-400 mb-1">
                    🔍 Data Fasih SM (UB, UM, UMK)
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc">
                    <li>
                      <b>UB, UM, UMK</b> – Skala usaha teridentifikasi dengan status <b>submit, approve, reject, atau revoke</b>
                    </li>
                    <li>
                      <b>Total</b> – UB + UM + UMK
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">
                    ⚡ Progres Realisasi Petugas
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc">
                    <li>
                      <b>Target</b> – Total prelist yang ditugaskan ke petugas pencacah
                    </li>
                    <li>
                      <b>Realisasi</b> – Prelist yang berstatus <b>submit, approve, reject, atau revoke</b>
                    </li>
                    <li>
                      <b>%</b> – Persentase realisasi petugas (Realisasi / Target)
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    📊 Selisih
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc">
                    <li>
                      <span className="text-emerald-500">+positif</span> –
                      Fasih SM lebih banyak dari SBR
                    </li>
                    <li>
                      <span className="text-red-500">−negatif</span> – Fasih SM
                      lebih sedikit dari SBR
                    </li>
                    <li>
                      <span className="text-slate-400">0</span> – Sama persis
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
