"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import {
  Search,
  User,
  MapPin,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Moon,
  Sun,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  X,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  BookOpen
} from "lucide-react";

// Interfaces for data types
interface ScraperRecord {
  searchedEmail: string;
  idCode: string;
  name: string;
  address: string;
  scale: string;
  jumlahUsaha: number;
  status: string;
  officer: string;
  sumberData: string;
  nama_kec: string;
  koseka: string;
  isPrioritas: string;
}

interface PMLPPLRecord {
  nama_petugas: string;
  kec: string;
  jabatan_petugas: string; // 'PML' or 'PPL'
  email: string;
}

interface CellStats {
  target: number;
  realisasi: number;
  open: number;
  draft: number;
  submit: number;
  approve: number;
  reject: number;
  revoked: number;
  // 10 individual statuses
  open_count: number;
  draft_count: number;
  submitted_pencacah: number;
  submitted_respondent: number;
  rejected_pengawas: number;
  rejected_admin: number;
  approved_pengawas: number;
  completed_admin: number;
  edited_admin: number;
  revoked_pengawas: number;
}

interface RowStats {
  nama: string;
  email: string;
  kec: string;
  jabatan: string;
  categories: { [category: string]: CellStats };
  total: CellStats;
}

interface KecStats {
  kecName: string;
  koseka: string;
  categories: { [category: string]: CellStats };
  total: CellStats;
}

interface SLSStats {
  slsCode: string;
  kec: string;
  koseka: string;
  isPrioritas: boolean;
  categories: { [category: string]: CellStats };
  total: CellStats;
}

const normalizeScale = (scaleStr: string): string => {
  if (!scaleStr) return "Keluarga";
  const s = scaleStr.trim().toUpperCase();
  if (!s || s === "-" || s === "TIDAK TERIDENTIFIKASI") return "Keluarga";
  if (s.includes("DUMMY")) return "UMKM/Dummy";
  if (s.includes("BANGUNAN_LAIN") || s.includes("BANGUNAN LAIN")) return "UMKM Bangunan Lain";
  if (s.includes("KELUARGA")) {
    if (s.includes("UMKM")) return "UMKM/Keluarga";
    return "Keluarga";
  }
  if (s.includes("UMK")) return "UMK";
  if (s === "UM") return "UM";
  if (s === "UB") return "UB";
  if (s.includes("UMKM")) return "UMKM/Keluarga";
  return "Keluarga";
};

const parseStatus = (statusStr: string) => {
  const status = (statusStr || "").toLowerCase().trim();
  
  const isOpen = status === "open" || status === "";
  const isDraft = status === "draft";
  const isSubmittedPencacah = status === "submitted by pencacah" || status === "submit" || status === "submitted";
  const isSubmittedRespondent = status === "submitted respondent";
  const isRejectedPengawas = status === "rejected by pengawas" || status === "reject" || status === "rejected";
  const isRejectedAdmin = status === "rejected by admin kabupaten";
  const isApprovedPengawas = status === "approved by pengawas" || status === "approve" || status === "approved";
  const isCompletedAdmin = status === "completed by admin kabupaten";
  const isEditedAdmin = status === "edited by admin kabupaten";
  const isRevokedPengawas = status === "revoked by pengawas" || status === "revoked";

  // For backward compatibility
  const isSubmit = isSubmittedPencacah || isSubmittedRespondent;
  const isApprove = isApprovedPengawas || isCompletedAdmin || isEditedAdmin;
  const isReject = isRejectedPengawas || isRejectedAdmin;
  const isRevoked = isRevokedPengawas;
  
  return {
    isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
    isSubmittedPencacah, isSubmittedRespondent,
    isRejectedPengawas, isRejectedAdmin,
    isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
  };
};

const calculateTargetAndDiff = (realisasiPct: number) => {
  const startDate = new Date("2026-06-15");
  const today = new Date();
  
  // Reset time to midnight for accurate day calculations
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Daily target addition happens at 12:00 PM (noon)
  let elapsedDays = diffDays;
  if (today.getHours() < 12) {
    elapsedDays = diffDays - 1;
  }
  elapsedDays = Math.max(0, elapsedDays);
  
  const dailyTarget = 100.0 / 60.0;
  const cumulativeTarget = elapsedDays * dailyTarget;
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

export default function TabulasiPage() {
  // Data states
  const [rawData, setRawData] = useState<ScraperRecord[]>([]);
  const [pmlPplData, setPmlPplData] = useState<PMLPPLRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const bannerTargetInfo = useMemo(() => calculateTargetAndDiff(0), [lastUpdated]);

  // Filter & Search states
  const [selectedKec, setSelectedKec] = useState<string>("all");
  const [selectedPml, setSelectedPml] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pcl" | "pml" | "kec" | "sls" | "sumber_data">("pcl");
  const [tabulationMetric, setTabulationMetric] = useState<"sampel" | "usaha">("sampel");

  // SLS pagination states
  const [slsPage, setSlsPage] = useState(1);
  const slsPerPage = 25;

  useEffect(() => {
    setSlsPage(1);
  }, [selectedKec, searchQuery, activeTab]);

  // Double scrollbar refs and state
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  const isScrollingTop = useRef(false);
  const isScrollingTable = useRef(false);

  const handleTopScroll = () => {
    if (isScrollingTable.current) return;
    isScrollingTop.current = true;
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    window.requestAnimationFrame(() => {
      isScrollingTop.current = false;
    });
  };

  const handleTableScroll = () => {
    if (isScrollingTop.current) return;
    isScrollingTable.current = true;
    if (tableContainerRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    window.requestAnimationFrame(() => {
      isScrollingTable.current = false;
    });
  };

  useEffect(() => {
    const updateWidth = () => {
      if (tableContainerRef.current) {
        const table = tableContainerRef.current.querySelector("table");
        if (table) {
          setTableWidth(table.offsetWidth);
        }
      }
    };

    updateWidth();
    const timer = setTimeout(updateWidth, 300);
    window.addEventListener("resize", updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateWidth);
    };
  }, [rawData, activeTab, selectedKec, selectedPml, searchQuery, slsPage]);

  // Helper to normalize subdistrict/kecamatan names for comparison
  const normalizeKec = (name: string): string => {
    if (!name) return "";
    return name.replace(/\(\d+\)/g, "").trim().toUpperCase();
  };

  // Helper to format subdistrict/kecamatan names to Title Case and strip BPS codes
  const formatKecName = (name: string): string => {
    if (!name) return "";
    let cleaned = name.replace(/\(\d+\)/g, "").trim();
    return cleaned
      .toLowerCase()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Fetch and parse data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch update_data.csv
      const dataResponse = await fetch("/update_data.csv");
      if (!dataResponse.ok) {
        throw new Error("Gagal mengambil file update_data.csv. Pastikan pipeline data sudah dijalankan.");
      }
      const dataText = await dataResponse.text();

      // Fetch pml_ppl.csv
      const pmlPplResponse = await fetch("/pml_ppl.csv");
      if (!pmlPplResponse.ok) {
        throw new Error("Gagal mengambil file pml_ppl.csv.");
      }
      const pmlPplText = await pmlPplResponse.text();

      // Parse update_data.csv
      const parseDataCSV = (csvText: string): ScraperRecord[] => {
        const lines = csvText.split("\n");
        const parsed: ScraperRecord[] = [];

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

          if (row.length >= 17 && row[1] && row[1].trim() !== "" && row[1] !== "Kode Identitas") {
            const parsedJU = parseInt(row[8].replace(/"/g, "").trim());
            parsed.push({
              searchedEmail: row[0].replace(/"/g, "").trim().toLowerCase(),
              idCode: row[1].replace(/"/g, "").trim(),
              name: row[2].replace(/"/g, "").trim(),
              address: row[3].replace(/"/g, "").trim(),
              scale: normalizeScale(row[7].replace(/"/g, "").trim()),
              jumlahUsaha: isNaN(parsedJU) ? 0 : parsedJU,
              status: row[12].replace(/"/g, "").trim(),
              officer: row[14].replace(/"/g, "").trim(),
              sumberData: row[16] ? row[16].replace(/"/g, "").trim() : "",
              nama_kec: row[17] ? row[17].replace(/"/g, "").trim() : "",
              koseka: row[18] ? row[18].replace(/"/g, "").trim() : "",
              isPrioritas: row[19] ? row[19].replace(/"/g, "").trim() : "Tidak",
            });
          }
        }
        return parsed;
      };

      // Parse pml_ppl.csv (semicolon delimited)
      const parsePMLPPL = (csvText: string): PMLPPLRecord[] => {
        const lines = csvText.split("\n");
        const parsed: PMLPPLRecord[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(";");
          if (parts.length >= 4) {
            parsed.push({
              nama_petugas: parts[0].replace(/"/g, "").trim(),
              kec: parts[1].replace(/"/g, "").trim(),
              jabatan_petugas: parts[2].replace(/"/g, "").trim().toUpperCase(),
              email: parts[3].replace(/"/g, "").trim().toLowerCase(),
            });
          }
        }
        return parsed;
      };

      const parsedRecords = parseDataCSV(dataText);
      const parsedPmlPpl = parsePMLPPL(pmlPplText);

      setRawData(parsedRecords);
      setPmlPplData(parsedPmlPpl);

      // Load timestamp
      let loadedTimestamp = "";
      try {
        const timeResponse = await fetch("/last_updated.txt");
        if (timeResponse.ok) {
          loadedTimestamp = (await timeResponse.text()).trim();
        }
      } catch (e) {
        console.warn("Gagal mengambil file last_updated.txt.");
      }

      if (loadedTimestamp) {
        setLastUpdated(loadedTimestamp);
      } else {
        const now = new Date();
        setLastUpdated(now.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) + " WITA");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Scale Category Mapping
  const categories = useMemo(() => [
    "Keluarga",
    "UMK",
    "UMKM Bangunan Lain",
    "UM",
    "UB",
    "UMKM/Dummy",
    "UMKM/Keluarga"
  ], []);

  const getScaleCategory = (scale: string): string => {
    return scale;
  };

  // Helper to initialize empty CellStats
  const createEmptyCellStats = (): CellStats => ({
    target: 0,
    realisasi: 0,
    open: 0,
    draft: 0,
    submit: 0,
    approve: 0,
    reject: 0,
    revoked: 0,
    // 10 individual statuses
    open_count: 0,
    draft_count: 0,
    submitted_pencacah: 0,
    submitted_respondent: 0,
    rejected_pengawas: 0,
    rejected_admin: 0,
    approved_pengawas: 0,
    completed_admin: 0,
    edited_admin: 0,
    revoked_pengawas: 0
  });

  // Unique lists from both data sources
  const uniqueKecList = useMemo(() => {
    const formattedSubdistricts = rawData.map(r => formatKecName(r.nama_kec)).filter(Boolean);
    const formattedAllKecs = pmlPplData.map(item => formatKecName(item.kec)).filter(Boolean);
    return Array.from(new Set([...formattedSubdistricts, ...formattedAllKecs])).sort();
  }, [rawData, pmlPplData]);

  // List of PMLs filtered by selected Kecamatan
  const pmlList = useMemo(() => {
    return pmlPplData.filter(item => {
      const matchRole = item.jabatan_petugas === "PML";
      const matchKec = selectedKec === "all" ? true : normalizeKec(item.kec) === normalizeKec(selectedKec);
      return matchRole && matchKec;
    }).sort((a, b) => a.nama_petugas.localeCompare(b.nama_petugas));
  }, [pmlPplData, selectedKec]);

  // Reset PML filter if selected Kecamatan changes and currently selected PML is not in new list
  useEffect(() => {
    if (selectedPml !== "all") {
      const pmlExists = pmlList.some(p => p.nama_petugas === selectedPml);
      if (!pmlExists) {
        setSelectedPml("all");
      }
    }
  }, [selectedKec, pmlList, selectedPml]);

  // If PML is selected, automatically update selectedKec to PML's Kecamatan
  const handlePmlChange = (pmlName: string) => {
    setSelectedPml(pmlName);
    if (pmlName !== "all") {
      const selectedPmlRecord = pmlPplData.find(item => item.nama_petugas === pmlName);
      if (selectedPmlRecord) {
        setSelectedKec(selectedPmlRecord.kec);
      }
    }
  };

  // Calculate Table 1: PCL (PPL) detail stats
  const pclStats = useMemo<RowStats[]>(() => {
    // 1. Get PPLs
    const ppls = pmlPplData.filter(item => item.jabatan_petugas === "PPL");

    // 2. Pre-filter PPLs by selected Kecamatan / PML
    const filteredPpls = ppls.filter(ppl => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(ppl.kec) === normalizeKec(selectedKec);
      return matchKec;
    });

    // 3. Map PPLs to their stats
    const stats: RowStats[] = filteredPpls.map(ppl => {
      const pplEmail = ppl.email.toLowerCase();
      // Filter records for this PPL
      const records = rawData.filter(r => r.searchedEmail === pplEmail);

      const rowStats: RowStats = {
        nama: ppl.nama_petugas,
        email: ppl.email,
        kec: ppl.kec,
        jabatan: ppl.jabatan_petugas,
        categories: {},
        total: createEmptyCellStats()
      };

      // Initialize categories
      categories.forEach(cat => {
        rowStats.categories[cat] = createEmptyCellStats();
      });

      // Aggregate records
      records.forEach(r => {
        const cat = getScaleCategory(r.scale);
        const {
          isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
          isSubmittedPencacah, isSubmittedRespondent,
          isRejectedPengawas, isRejectedAdmin,
          isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
        } = parseStatus(r.status);
        const isRealisasi = isSubmit || isReject || isApprove || isRevoked;

        const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;

        // Helper to add stats
        const addStats = (cell: CellStats) => {
          cell.target += val;
          if (isRealisasi) cell.realisasi += val;
          if (isOpen) cell.open += val;
          if (isDraft) cell.draft += val;
          if (isSubmit) cell.submit += val;
          if (isApprove) cell.approve += val;
          if (isReject) cell.reject += val;
          if (isRevoked) cell.revoked += val;

          if (isOpen) cell.open_count += val;
          if (isDraft) cell.draft_count += val;
          if (isSubmittedPencacah) cell.submitted_pencacah += val;
          if (isSubmittedRespondent) cell.submitted_respondent += val;
          if (isRejectedPengawas) cell.rejected_pengawas += val;
          if (isRejectedAdmin) cell.rejected_admin += val;
          if (isApprovedPengawas) cell.approved_pengawas += val;
          if (isCompletedAdmin) cell.completed_admin += val;
          if (isEditedAdmin) cell.edited_admin += val;
          if (isRevokedPengawas) cell.revoked_pengawas += val;
        };

        // Add to category
        if (cat && rowStats.categories[cat]) {
          addStats(rowStats.categories[cat]);
        }
        // Add to total
        addStats(rowStats.total);
      });

      return rowStats;
    });

    // Sort by name
    return stats.sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rawData, pmlPplData, selectedKec, categories, tabulationMetric]);

  // Filtered Table 1 based on search query
  const filteredPclStats = useMemo(() => {
    return pclStats.filter(pcl => {
      if (!searchQuery) return true;
      return pcl.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
             pcl.kec.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [pclStats, searchQuery]);

  // Calculate Table 3: PML (Pengawas) detail stats
  const pmlStats = useMemo<RowStats[]>(() => {
    // 1. Get PMLs
    const pmls = pmlPplData.filter(item => item.jabatan_petugas === "PML");

    // 2. Pre-filter PMLs by selected Kecamatan / PML filter
    const filteredPmls = pmls.filter(pml => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(pml.kec) === normalizeKec(selectedKec);
      const matchPml = selectedPml === "all" ? true : pml.nama_petugas === selectedPml;
      return matchKec && matchPml;
    });

    // 3. Map PMLs to their stats (aggregated from PPLs in the same Kecamatan)
    const stats: RowStats[] = filteredPmls.map(pml => {
      const normalizedKecName = normalizeKec(pml.kec);
      
      // Get all PPLs in the same subdistrict
      const pplsInKec = pmlPplData.filter(item => item.jabatan_petugas === "PPL" && normalizeKec(item.kec) === normalizedKecName);
      const emailsInKec = new Set(pplsInKec.map(ppl => ppl.email.toLowerCase()));

      // Get records for these PPLs
      const records = rawData.filter(r => emailsInKec.has(r.searchedEmail) || normalizeKec(r.nama_kec) === normalizedKecName);

      const rowStats: RowStats = {
        nama: pml.nama_petugas,
        email: pml.email,
        kec: pml.kec,
        jabatan: pml.jabatan_petugas,
        categories: {},
        total: createEmptyCellStats()
      };

      // Initialize categories
      categories.forEach(cat => {
        rowStats.categories[cat] = createEmptyCellStats();
      });

      // Aggregate records
      records.forEach(r => {
        const cat = getScaleCategory(r.scale);
        const {
          isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
          isSubmittedPencacah, isSubmittedRespondent,
          isRejectedPengawas, isRejectedAdmin,
          isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
        } = parseStatus(r.status);
        const isRealisasi = isReject || isApprove || isRevoked; // PML realisasi = reject + approve + revoked

        const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;

        const addStats = (cell: CellStats) => {
          cell.target += val;
          if (isRealisasi) cell.realisasi += val;
          if (isOpen) cell.open += val;
          if (isDraft) cell.draft += val;
          if (isSubmit) cell.submit += val;
          if (isApprove) cell.approve += val;
          if (isReject) cell.reject += val;
          if (isRevoked) cell.revoked += val;

          if (isOpen) cell.open_count += val;
          if (isDraft) cell.draft_count += val;
          if (isSubmittedPencacah) cell.submitted_pencacah += val;
          if (isSubmittedRespondent) cell.submitted_respondent += val;
          if (isRejectedPengawas) cell.rejected_pengawas += val;
          if (isRejectedAdmin) cell.rejected_admin += val;
          if (isApprovedPengawas) cell.approved_pengawas += val;
          if (isCompletedAdmin) cell.completed_admin += val;
          if (isEditedAdmin) cell.edited_admin += val;
          if (isRevokedPengawas) cell.revoked_pengawas += val;
        };

        if (cat && rowStats.categories[cat]) {
          addStats(rowStats.categories[cat]);
        }
        addStats(rowStats.total);
      });

      return rowStats;
    });

    return stats.sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rawData, pmlPplData, selectedKec, selectedPml, categories, tabulationMetric]);

  // Filtered Table 3 based on search query
  const filteredPmlStats = useMemo(() => {
    return pmlStats.filter(pml => {
      if (!searchQuery) return true;
      return pml.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
             pml.kec.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [pmlStats, searchQuery]);

  // Overview stats for PML tab (prevents double counting)
  const selectedPmlOverviewStats = useMemo(() => {
    const totalStats = createEmptyCellStats();
    
    // Find the unique kecamatan names of all currently visible PMLs
    const visibleKecs = new Set(filteredPmlStats.map(pml => normalizeKec(pml.kec)));
    
    // Find unique PPLs in these kecamatans
    const ppls = pmlPplData.filter(item => item.jabatan_petugas === "PPL" && visibleKecs.has(normalizeKec(item.kec)));
    const pplEmails = new Set(ppls.map(p => p.email.toLowerCase()));
    
    // Sum stats of records for these PPLs
    const records = rawData.filter(r => pplEmails.has(r.searchedEmail) || visibleKecs.has(normalizeKec(r.nama_kec)));
    
    records.forEach(r => {
      const {
        isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
        isSubmittedPencacah, isSubmittedRespondent,
        isRejectedPengawas, isRejectedAdmin,
        isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
      } = parseStatus(r.status);
      const isRealisasi = isReject || isApprove || isRevoked; // PML realisasi = reject + approve + revoked

      const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;
      totalStats.target += val;
      if (isRealisasi) totalStats.realisasi += val;
      if (isOpen) totalStats.open += val;
      if (isDraft) totalStats.draft += val;
      if (isSubmit) totalStats.submit += val;
      if (isApprove) totalStats.approve += val;
      if (isReject) totalStats.reject += val;
      if (isRevoked) totalStats.revoked += val;

      if (isOpen) totalStats.open_count += val;
      if (isDraft) totalStats.draft_count += val;
      if (isSubmittedPencacah) totalStats.submitted_pencacah += val;
      if (isSubmittedRespondent) totalStats.submitted_respondent += val;
      if (isRejectedPengawas) totalStats.rejected_pengawas += val;
      if (isRejectedAdmin) totalStats.rejected_admin += val;
      if (isApprovedPengawas) totalStats.approved_pengawas += val;
      if (isCompletedAdmin) totalStats.completed_admin += val;
      if (isEditedAdmin) totalStats.edited_admin += val;
      if (isRevokedPengawas) totalStats.revoked_pengawas += val;
    });
    
    const completionRate = totalStats.target > 0 ? (totalStats.realisasi / totalStats.target) * 100 : 0;
    
    return {
      ...totalStats,
      completionRate
    };
  }, [rawData, pmlPplData, filteredPmlStats, tabulationMetric]);

  // Calculate Table 4: SLS Overview stats
  const slsStats = useMemo<SLSStats[]>(() => {
    const statsMap: { [slsCode: string]: SLSStats } = {};

    rawData.forEach(r => {
      const digits = r.idCode.replace(/\D/g, "");
      if (digits.length < 14) return;
      const slsCode = digits.substring(0, 14);

      if (!statsMap[slsCode]) {
        statsMap[slsCode] = {
          slsCode,
          kec: formatKecName(r.nama_kec),
          koseka: r.koseka,
          isPrioritas: r.isPrioritas === "Ya",
          categories: {},
          total: createEmptyCellStats()
        };
        categories.forEach(cat => {
          statsMap[slsCode].categories[cat] = createEmptyCellStats();
        });
      }

      const cat = getScaleCategory(r.scale);
      const {
        isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
        isSubmittedPencacah, isSubmittedRespondent,
        isRejectedPengawas, isRejectedAdmin,
        isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
      } = parseStatus(r.status);
      const isRealisasi = isSubmit || isReject || isApprove || isRevoked;

      const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;

      const addStats = (cell: CellStats) => {
        cell.target += val;
        if (isRealisasi) cell.realisasi += val;
        if (isOpen) cell.open += val;
        if (isDraft) cell.draft += val;
        if (isSubmit) cell.submit += val;
        if (isApprove) cell.approve += val;
        if (isReject) cell.reject += val;
        if (isRevoked) cell.revoked += val;

        if (isOpen) cell.open_count += val;
        if (isDraft) cell.draft_count += val;
        if (isSubmittedPencacah) cell.submitted_pencacah += val;
        if (isSubmittedRespondent) cell.submitted_respondent += val;
        if (isRejectedPengawas) cell.rejected_pengawas += val;
        if (isRejectedAdmin) cell.rejected_admin += val;
        if (isApprovedPengawas) cell.approved_pengawas += val;
        if (isCompletedAdmin) cell.completed_admin += val;
        if (isEditedAdmin) cell.edited_admin += val;
        if (isRevokedPengawas) cell.revoked_pengawas += val;
      };

      if (cat && statsMap[slsCode].categories[cat]) {
        addStats(statsMap[slsCode].categories[cat]);
      }
      addStats(statsMap[slsCode].total);
    });

    return Object.values(statsMap).sort((a, b) => a.slsCode.localeCompare(b.slsCode));
  }, [rawData, categories, tabulationMetric]);

  // Filtered Table 4 based on search query and selected filters
  const filteredSlsStats = useMemo(() => {
    return slsStats.filter(sls => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(sls.kec) === normalizeKec(selectedKec);
      if (!matchKec) return false;

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return sls.slsCode.includes(query) || sls.kec.toLowerCase().includes(query);
    });
  }, [slsStats, selectedKec, searchQuery]);

  // Overview stats for SLS tab (prevents double counting)
  const selectedSlsOverviewStats = useMemo(() => {
    const totalStats = createEmptyCellStats();

    filteredSlsStats.forEach(sls => {
      const t = sls.total;
      totalStats.target += t.target;
      totalStats.realisasi += t.realisasi;
      totalStats.open += t.open;
      totalStats.draft += t.draft;
      totalStats.submit += t.submit;
      totalStats.approve += t.approve;
      totalStats.reject += t.reject;
      totalStats.revoked += t.revoked;

      totalStats.open_count += t.open_count;
      totalStats.draft_count += t.draft_count;
      totalStats.submitted_pencacah += t.submitted_pencacah;
      totalStats.submitted_respondent += t.submitted_respondent;
      totalStats.rejected_pengawas += t.rejected_pengawas;
      totalStats.rejected_admin += t.rejected_admin;
      totalStats.approved_pengawas += t.approved_pengawas;
      totalStats.completed_admin += t.completed_admin;
      totalStats.edited_admin += t.edited_admin;
      totalStats.revoked_pengawas += t.revoked_pengawas;
    });

    const completionRate = totalStats.target > 0 ? (totalStats.realisasi / totalStats.target) * 100 : 0;

    return {
      ...totalStats,
      completionRate
    };
  }, [filteredSlsStats]);

  const paginatedSlsStats = useMemo(() => {
    const startIndex = (slsPage - 1) * slsPerPage;
    return filteredSlsStats.slice(startIndex, startIndex + slsPerPage);
  }, [filteredSlsStats, slsPage]);

  const totalSlsPages = Math.ceil(filteredSlsStats.length / slsPerPage) || 1;

  // Calculate Table 5: Sumber Data Overview stats
  const sumberDataStats = useMemo<KecStats[]>(() => {
    const statsMap: { [sumberName: string]: KecStats } = {};

    const sumbers = rawData.map(r => r.sumberData).filter(Boolean);
    const uniqueSumberNames = Array.from(new Set(sumbers)).sort();

    uniqueSumberNames.forEach(sumber => {
      const kecStats: KecStats = {
        kecName: sumber,
        koseka: "-",
        categories: {},
        total: createEmptyCellStats()
      };

      categories.forEach(cat => {
        kecStats.categories[cat] = createEmptyCellStats();
      });

      const records = rawData.filter(r => r.sumberData === sumber);

      records.forEach(r => {
        const cat = getScaleCategory(r.scale);
        const {
          isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
          isSubmittedPencacah, isSubmittedRespondent,
          isRejectedPengawas, isRejectedAdmin,
          isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
        } = parseStatus(r.status);
        const isRealisasi = isSubmit || isReject || isApprove || isRevoked;

        const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;

        const addStats = (cell: CellStats) => {
          cell.target += val;
          if (isRealisasi) cell.realisasi += val;
          if (isOpen) cell.open += val;
          if (isDraft) cell.draft += val;
          if (isSubmit) cell.submit += val;
          if (isApprove) cell.approve += val;
          if (isReject) cell.reject += val;
          if (isRevoked) cell.revoked += val;

          if (isOpen) cell.open_count += val;
          if (isDraft) cell.draft_count += val;
          if (isSubmittedPencacah) cell.submitted_pencacah += val;
          if (isSubmittedRespondent) cell.submitted_respondent += val;
          if (isRejectedPengawas) cell.rejected_pengawas += val;
          if (isRejectedAdmin) cell.rejected_admin += val;
          if (isApprovedPengawas) cell.approved_pengawas += val;
          if (isCompletedAdmin) cell.completed_admin += val;
          if (isEditedAdmin) cell.edited_admin += val;
          if (isRevokedPengawas) cell.revoked_pengawas += val;
        };

        if (cat && kecStats.categories[cat]) {
          addStats(kecStats.categories[cat]);
        }
        addStats(kecStats.total);
      });

      statsMap[sumber] = kecStats;
    });

    return Object.values(statsMap).sort((a, b) => a.kecName.localeCompare(b.kecName));
  }, [rawData, categories, tabulationMetric]);

  // Filtered Table 5: Sumber Data based on search query
  const filteredSumberDataStats = useMemo(() => {
    if (activeTab !== "sumber_data") return [];
    return sumberDataStats.filter(item => {
      if (!searchQuery) return true;
      return item.kecName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [sumberDataStats, activeTab, searchQuery]);

  // Calculate Table 2: Kecamatan Overview stats
  const kecamatanStats = useMemo<KecStats[]>(() => {
    const statsMap: { [kecName: string]: KecStats } = {};

    // Load subdistrict names from koseka mapping or scraped data
    const subdistricts = rawData.map(r => formatKecName(r.nama_kec)).filter(Boolean);
    
    // Fallback: load all Kec from pml_ppl.csv
    const allKecs = pmlPplData.map(item => formatKecName(item.kec)).filter(Boolean);
    const uniqueKecNames = Array.from(new Set([...subdistricts, ...allKecs])).sort();

    // Helper to get koseka name for a kecamatan
    const getKosekaForKec = (kecName: string): string => {
      const normalized = normalizeKec(kecName);
      const record = rawData.find(r => normalizeKec(r.nama_kec) === normalized);
      return record ? record.koseka : "-";
    };

    uniqueKecNames.forEach(kec => {
      const normalizedKecName = normalizeKec(kec);
      
      const kecStats: KecStats = {
        kecName: kec, // formatted Title Case name
        koseka: getKosekaForKec(kec),
        categories: {},
        total: createEmptyCellStats()
      };

      categories.forEach(cat => {
        kecStats.categories[cat] = createEmptyCellStats();
      });

      // Find PPL emails in this Kecamatan
      const pplsInKec = pmlPplData.filter(item => item.jabatan_petugas === "PPL" && normalizeKec(item.kec) === normalizedKecName);
      const emailsInKec = new Set(pplsInKec.map(ppl => ppl.email.toLowerCase()));

      // Aggregate records where searchedEmail is in this subdistrict
      const records = rawData.filter(r => emailsInKec.has(r.searchedEmail) || normalizeKec(r.nama_kec) === normalizedKecName);

      records.forEach(r => {
        const cat = getScaleCategory(r.scale);
        const {
          isOpen, isDraft, isSubmit, isApprove, isReject, isRevoked,
          isSubmittedPencacah, isSubmittedRespondent,
          isRejectedPengawas, isRejectedAdmin,
          isApprovedPengawas, isCompletedAdmin, isEditedAdmin, isRevokedPengawas
        } = parseStatus(r.status);
        const isRealisasi = isSubmit || isReject || isApprove || isRevoked; // Kecamatan uses: submit + reject + approve + revoked

        const val = tabulationMetric === "sampel" ? 1 : r.jumlahUsaha;

        const addStats = (cell: CellStats) => {
          cell.target += val;
          if (isRealisasi) cell.realisasi += val;
          if (isOpen) cell.open += val;
          if (isDraft) cell.draft += val;
          if (isSubmit) cell.submit += val;
          if (isApprove) cell.approve += val;
          if (isReject) cell.reject += val;
          if (isRevoked) cell.revoked += val;

          if (isOpen) cell.open_count += val;
          if (isDraft) cell.draft_count += val;
          if (isSubmittedPencacah) cell.submitted_pencacah += val;
          if (isSubmittedRespondent) cell.submitted_respondent += val;
          if (isRejectedPengawas) cell.rejected_pengawas += val;
          if (isRejectedAdmin) cell.rejected_admin += val;
          if (isApprovedPengawas) cell.approved_pengawas += val;
          if (isCompletedAdmin) cell.completed_admin += val;
          if (isEditedAdmin) cell.edited_admin += val;
          if (isRevokedPengawas) cell.revoked_pengawas += val;
        };

        if (cat && kecStats.categories[cat]) {
          addStats(kecStats.categories[cat]);
        }
        addStats(kecStats.total);
      });

      statsMap[kec] = kecStats;
    });

    return Object.values(statsMap).sort((a, b) => a.kecName.localeCompare(b.kecName));
  }, [rawData, pmlPplData, categories, tabulationMetric]);

  // Overall Statistics for Selected View
  const selectedOverviewStats = useMemo(() => {
    const totalStats = createEmptyCellStats();

    filteredPclStats.forEach(pcl => {
      const t = pcl.total;
      totalStats.target += t.target;
      totalStats.realisasi += t.realisasi;
      totalStats.open += t.open;
      totalStats.draft += t.draft;
      totalStats.submit += t.submit;
      totalStats.approve += t.approve;
      totalStats.reject += t.reject;
      totalStats.revoked += t.revoked;

      totalStats.open_count += t.open_count;
      totalStats.draft_count += t.draft_count;
      totalStats.submitted_pencacah += t.submitted_pencacah;
      totalStats.submitted_respondent += t.submitted_respondent;
      totalStats.rejected_pengawas += t.rejected_pengawas;
      totalStats.rejected_admin += t.rejected_admin;
      totalStats.approved_pengawas += t.approved_pengawas;
      totalStats.completed_admin += t.completed_admin;
      totalStats.edited_admin += t.edited_admin;
      totalStats.revoked_pengawas += t.revoked_pengawas;
    });

    const completionRate = totalStats.target > 0 ? (totalStats.realisasi / totalStats.target) * 100 : 0;

    return {
      ...totalStats,
      completionRate
    };
  }, [filteredPclStats]);

  // Export functions to CSV
  const handleExportCSV = () => {
    let headers = ["Nama / Kode SLS", "Kecamatan", "Jabatan / Koseka"];
    
    // Add categories sub-headers
    categories.forEach(cat => {
      headers.push(
        `[${cat}] Target`,
        `[${cat}] Realisasi`,
        `[${cat}] Open`,
        `[${cat}] Submitted by Pencacah`,
        `[${cat}] Draft`,
        `[${cat}] Rejected by Pengawas`,
        `[${cat}] Approved by Pengawas`
      );
    });

    headers.push("Total Target", "Total Realisasi", "Total Open", "Total Submitted by Pencacah", "Total Draft", "Total Rejected by Pengawas", "Total Approved by Pengawas");

    const csvRows = [headers.join(",")];

    if (activeTab === "pcl") {
      filteredPclStats.forEach(pcl => {
        const row: (string | number)[] = [
          `"${pcl.nama}"`,
          `"${pcl.kec}"`,
          `"${pcl.jabatan}"`
        ];

        categories.forEach(cat => {
          const stats = pcl.categories[cat];
          row.push(
            stats.target,
            stats.realisasi,
            stats.open,
            stats.submit,
            stats.draft,
            stats.reject,
            stats.approve
          );
        });

        row.push(
          pcl.total.target,
          pcl.total.realisasi,
          pcl.total.open,
          pcl.total.submit,
          pcl.total.draft,
          pcl.total.reject,
          pcl.total.approve
        );

        csvRows.push(row.join(","));
      });
    } else if (activeTab === "pml") {
      filteredPmlStats.forEach(pml => {
        const row: (string | number)[] = [
          `"${pml.nama}"`,
          `"${pml.kec}"`,
          `"${pml.jabatan}"`
        ];

        categories.forEach(cat => {
          const stats = pml.categories[cat];
          row.push(
            stats.target,
            stats.realisasi,
            stats.open,
            stats.submit,
            stats.draft,
            stats.reject,
            stats.approve
          );
        });

        row.push(
          pml.total.target,
          pml.total.realisasi,
          pml.total.open,
          pml.total.submit,
          pml.total.draft,
          pml.total.reject,
          pml.total.approve
        );

        csvRows.push(row.join(","));
      });
    } else if (activeTab === "sls") {
      filteredSlsStats.forEach(sls => {
        const row: (string | number)[] = [
          `"${sls.slsCode}"`,
          `"${sls.kec}"`,
          `"${sls.koseka}"`
        ];

        categories.forEach(cat => {
          const stats = sls.categories[cat];
          row.push(
            stats.target,
            stats.realisasi,
            stats.open,
            stats.submit,
            stats.draft,
            stats.reject,
            stats.approve
          );
        });

        row.push(
          sls.total.target,
          sls.total.realisasi,
          sls.total.open,
          sls.total.submit,
          sls.total.draft,
          sls.total.reject,
          sls.total.approve
        );

        csvRows.push(row.join(","));
      });
    } else if (activeTab === "sumber_data") {
      filteredSumberDataStats.forEach(sumber => {
        const row: (string | number)[] = [
          `"${sumber.kecName}"`,
          `"-"`,
          `"-"`
        ];

        categories.forEach(cat => {
          const stats = sumber.categories[cat];
          row.push(
            stats.target,
            stats.realisasi,
            stats.open,
            stats.submit,
            stats.draft,
            stats.reject,
            stats.approve
          );
        });

        row.push(
          sumber.total.target,
          sumber.total.realisasi,
          sumber.total.open,
          sumber.total.submit,
          sumber.total.draft,
          sumber.total.reject,
          sumber.total.approve
        );

        csvRows.push(row.join(","));
      });
    } else {
      kecamatanStats.forEach(kec => {
        const row: (string | number)[] = [
          `"${kec.kecName}"`,
          `"-"`,
          `"${kec.koseka}"`
        ];

        categories.forEach(cat => {
          const stats = kec.categories[cat];
          row.push(
            stats.target,
            stats.realisasi,
            stats.open,
            stats.submit,
            stats.draft,
            stats.reject,
            stats.approve
          );
        });

        row.push(
          kec.total.target,
          kec.total.realisasi,
          kec.total.open,
          kec.total.submit,
          kec.total.draft,
          kec.total.reject,
          kec.total.approve
        );

        csvRows.push(row.join(","));
      });
    }

    const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    const filename = activeTab === "pcl" 
      ? `tabulasi_pcl_monitoring_se2026_${tabulationMetric === "usaha" ? "jumlah_usaha_" : ""}${Date.now()}.csv`
      : activeTab === "pml"
        ? `tabulasi_pml_monitoring_se2026_${tabulationMetric === "usaha" ? "jumlah_usaha_" : ""}${Date.now()}.csv`
        : activeTab === "sls"
          ? `tabulasi_sls_monitoring_se2026_${tabulationMetric === "usaha" ? "jumlah_usaha_" : ""}${Date.now()}.csv`
          : activeTab === "sumber_data"
            ? `tabulasi_sumber_data_monitoring_se2026_${tabulationMetric === "usaha" ? "jumlah_usaha_" : ""}${Date.now()}.csv`
            : `tabulasi_kecamatan_monitoring_se2026_${tabulationMetric === "usaha" ? "jumlah_usaha_" : ""}${Date.now()}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render sub-cell content
  const CellContent = ({ stats, highlight }: { stats: CellStats; highlight?: boolean }) => {
    if (stats.target === 0) {
      return (
        <div className="text-center text-xs text-slate-400 dark:text-slate-600 font-mono py-4">
          -
        </div>
      );
    }

    const pct = stats.target > 0 ? ((stats.realisasi / stats.target) * 100).toFixed(1) : "0.0";

    return (
      <div className={`p-1.5 text-xs text-left font-mono rounded-lg transition-colors ${
        highlight 
          ? "bg-orange-500/10 dark:bg-orange-500/5 text-orange-950 dark:text-orange-200" 
          : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
      }`}>
        <div className="font-extrabold text-slate-900 dark:text-white flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-0.5 mb-1">
          <span>Target:</span>
          <span>{stats.target}</span>
        </div>
        <div className="font-extrabold text-emerald-600 dark:text-emerald-400 flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-0.5 mb-1">
          <span>Realisasi:</span>
          <span>{stats.realisasi}</span>
        </div>
        <div className={`font-extrabold flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-0.5 mb-1 ${
          parseFloat(pct) >= 100
            ? "text-blue-600 dark:text-blue-400"
            : "text-orange-600 dark:text-orange-450"
        }`}>
          <span>% Realisasi:</span>
          <span>{pct}%</span>
        </div>
        <div className="space-y-0.5 opacity-90 text-[10px] pl-1 font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex justify-between gap-2">
            <span>1. Open</span>
            <span className="font-bold text-amber-600 dark:text-amber-500">{stats.open_count}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>2. Draft</span>
            <span className="font-bold text-blue-600 dark:text-blue-500">{stats.draft_count}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>3. Sub PPL</span>
            <span className="font-bold text-teal-650 dark:text-teal-400">{stats.submitted_pencacah}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>4. Sub Resp</span>
            <span className="font-bold text-teal-600/80 dark:text-teal-400/80">{stats.submitted_respondent}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>5. Rej PML</span>
            <span className="font-bold text-red-600 dark:text-red-500">{stats.rejected_pengawas}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>6. Rej Kab</span>
            <span className="font-bold text-red-600/80 dark:text-red-400/80">{stats.rejected_admin}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>7. App PML</span>
            <span className="font-bold text-emerald-650 dark:text-emerald-500">{stats.approved_pengawas}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>8. Comp Kab</span>
            <span className="font-bold text-emerald-650/80 dark:text-emerald-450/85">{stats.completed_admin}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>9. Edit Kab</span>
            <span className="font-bold text-emerald-600/80 dark:text-emerald-400/80">{stats.edited_admin}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>10. Revoked</span>
            <span className="font-bold text-rose-600 dark:text-rose-500/90">{stats.revoked_pengawas}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      <Navbar />

      {/* Main Body */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Title */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-5 sm:p-10 text-white shadow-xl shadow-orange-600/10 mb-8">
          <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-20 -translate-y-20"></div>
          <div className="absolute right-1/4 bottom-0 w-60 h-60 rounded-full bg-orange-400/20 blur-2xl translate-y-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/20 text-white mb-2 inline-block">
                Tabulasi & Kalkulasi Progres
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                Tabel Kalkulasi Progres Pendataan
              </h2>
              <p className="text-xs sm:text-base md:text-lg text-orange-50 max-w-2xl font-light">
                Perhitungan real-time target dan realisasi status sampel per Petugas (PCL) dan Kecamatan di wilayah Kabupaten Kepulauan Sangihe.
              </p>
            </div>
            
            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 flex flex-col items-start md:items-end border border-white/10 text-left md:text-right">
                <span className="text-[10px] sm:text-xs text-orange-200">Terakhir Diperbarui</span>
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

        {/* Loading and Error States */}
        {loading && rawData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-sm">
              Mengekstrak dan Memproses Data Tabulasi BPS FASIH...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-center mb-8">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">Terjadi Kesalahan</h3>
            <p className="text-sm opacity-90 max-w-md mx-auto mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-semibold"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <>
            {/* Warning Banner Info */}
            <div className="mb-6 p-4 rounded-xl border bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Ketentuan Pewarnaan & Rekapitulasi Target Harian:</span>
                <ul className="list-disc list-inside mt-1 flex flex-col gap-1 text-slate-600 dark:text-slate-300">
                  <li>
                    Target Harian: <span className="font-bold text-slate-800 dark:text-slate-200">1,67%</span> per hari | Dimulai: <span className="font-bold text-slate-800 dark:text-slate-200">15 Juni 2026</span> | Hari ke-<span className="font-bold text-slate-800 dark:text-slate-200">{bannerTargetInfo.elapsedDays}</span> (Target Akumulatif: <span className="font-bold text-slate-800 dark:text-slate-200">{bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                  </li>
                  <li>
                    Aturan Pewarnaan Baris & Realisasi (PCL, PML, Kecamatan):
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
                        <span className="text-amber-650 dark:text-amber-500 font-extrabold">Kuning</span>: Di antara 50% target s.d target harian akumulatif (<span className="font-bold font-mono">{(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}% s.d &lt; {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-bold">Progres</span> dihitung dari jumlah status yang bukan OPEN dan DRAFT.
                  </li>
                  <li>
                    <span className="font-bold">Realisasi PCL & Kecamatan</span> = APPROVED BY Pengawas + SUBMITTED BY Pencacah + REJECTED BY Pengawas + REJECTED BY Admin Kabupaten + REVOKED BY Pengawas + SUBMITTED RESPONDENT + COMPLETED BY Admin Kabupaten + EDITED BY Admin Kabupaten.
                  </li>
                  <li>
                    <span className="font-bold">Realisasi PML</span> = APPROVED BY Pengawas + REJECTED BY Pengawas + REVOKED BY Pengawas + REJECTED BY Admin Kabupaten + COMPLETED BY Admin Kabupaten + EDITED BY Admin Kabupaten.
                  </li>
                </ul>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto scrollbar-none flex-nowrap min-w-0 w-full">
              <button
                onClick={() => { setActiveTab("pcl"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "pcl"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <User className="w-4 h-4" />
                Detail Petugas (PCL / PPL)
              </button>
              <button
                onClick={() => { setActiveTab("pml"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "pml"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Detail Pengawas (PML)
              </button>
              <button
                onClick={() => { setActiveTab("sls"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "sls"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="w-4 h-4" />
                Rekapitulasi SLS
              </button>
              <button
                onClick={() => { setActiveTab("sumber_data"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "sumber_data"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Sumber Data
              </button>
              <button
                onClick={() => { setActiveTab("kec"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "kec"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Building className="w-4 h-4" />
                Ringkasan Wilayah (Kecamatan Overview)
              </button>
            </div>

            {/* Filter Section Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Left: Interactive Dropdown selectors */}
                <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
                  
                  {/* Metrik Selector */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                    <button
                      onClick={() => setTabulationMetric("sampel")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tabulationMetric === "sampel"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Jumlah Sampel
                    </button>
                    <button
                      onClick={() => setTabulationMetric("usaha")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tabulationMetric === "usaha"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Jumlah Usaha
                    </button>
                  </div>

                  {(activeTab === "pcl" || activeTab === "pml" || activeTab === "sls") && (
                    <>
                      {/* Kecamatan Dropdown */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold w-full sm:w-auto">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        <select
                          value={selectedKec}
                          onChange={(e) => setSelectedKec(e.target.value)}
                          className="w-full sm:w-auto py-2.5 px-3.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold cursor-pointer"
                        >
                          <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Kecamatan</option>
                          {uniqueKecList.map((kec, idx) => (
                            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={idx} value={kec}>{kec}</option>
                          ))}
                        </select>
                      </div>

                      {/* PML Dropdown */}
                      {(activeTab === "pcl" || activeTab === "pml") && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold w-full sm:w-auto">
                          <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                          <select
                            value={selectedPml}
                            onChange={(e) => handlePmlChange(e.target.value)}
                            className="w-full sm:w-auto py-2.5 px-3.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold cursor-pointer"
                          >
                            <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua PML (Pengawas)</option>
                            {pmlList.map((pml, idx) => (
                              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={idx} value={pml.nama_petugas}>{pml.nama_petugas}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Search Input */}
                  {(activeTab === "pcl" || activeTab === "pml" || activeTab === "sls" || activeTab === "sumber_data") && (
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <input
                        type="text"
                        placeholder={
                          activeTab === "pcl" 
                            ? "Cari nama PCL..." 
                            : activeTab === "pml" 
                              ? "Cari nama PML..." 
                              : activeTab === "sumber_data"
                                ? "Cari sumber data..."
                                : "Cari SLS / Kecamatan..."
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-semibold text-slate-950 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Export button */}
                <div className="w-full md:w-auto flex justify-end">
                  <button
                    onClick={handleExportCSV}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-950 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4 text-orange-500" />
                    <span>Ekspor CSV</span>
                  </button>
                </div>

              </div>

              {/* Progress Summary Cards */}
              {activeTab === "pcl" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total PCL Tampil</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{filteredPclStats.length} petugas</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Beban Target</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{selectedOverviewStats.target.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Realisasi</span>
                    <span className="text-xl font-extrabold text-emerald-500 mt-1 block">{selectedOverviewStats.realisasi.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Persentase Selesai</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black text-orange-500">{selectedOverviewStats.completionRate.toFixed(2)}%</span>
                      <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${selectedOverviewStats.completionRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "pml" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total PML Tampil</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{filteredPmlStats.length} pengawas</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Beban Target</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{selectedPmlOverviewStats.target.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Realisasi</span>
                    <span className="text-xl font-extrabold text-emerald-500 mt-1 block">{selectedPmlOverviewStats.realisasi.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Persentase Selesai</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black text-orange-500">{selectedPmlOverviewStats.completionRate.toFixed(2)}%</span>
                      <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${selectedPmlOverviewStats.completionRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "sls" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total SLS Tampil</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{filteredSlsStats.length} SLS</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Beban Target</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{selectedSlsOverviewStats.target.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Realisasi</span>
                    <span className="text-xl font-extrabold text-emerald-500 mt-1 block">{selectedSlsOverviewStats.realisasi.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Persentase Selesai</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black text-orange-500">{selectedSlsOverviewStats.completionRate.toFixed(2)}%</span>
                      <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${selectedSlsOverviewStats.completionRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "sumber_data" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Sumber Data</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{filteredSumberDataStats.length} jenis</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Beban Target</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                      {filteredSumberDataStats.reduce((sum, item) => sum + item.total.target, 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Total Realisasi</span>
                    <span className="text-xl font-extrabold text-emerald-500 mt-1 block">
                      {filteredSumberDataStats.reduce((sum, item) => sum + item.total.realisasi, 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Persentase Selesai</span>
                    {(() => {
                      const t = filteredSumberDataStats.reduce((sum, item) => sum + item.total.target, 0);
                      const r = filteredSumberDataStats.reduce((sum, item) => sum + item.total.realisasi, 0);
                      const pct = t > 0 ? (r / t) * 100 : 0;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-orange-500">{pct.toFixed(2)}%</span>
                          <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Content Table Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg overflow-hidden">
              {/* Top scrollbar synced with table */}
              <div 
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="hidden md:block overflow-x-auto overflow-y-hidden w-full bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800"
                style={{ height: "10px" }}
              >
                <div style={{ width: `${tableWidth}px`, height: "10px" }} />
              </div>

              <div 
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                className="overflow-auto max-h-[700px] w-full"
              >
                
                {activeTab === "pcl" ? (
                  // =================== TABLE 1: DETAIL PCL ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 min-w-[1200px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      {/* Top Header Row */}
                      <tr className="bg-orange-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold text-left w-56 sticky left-0 bg-orange-100 dark:bg-slate-800 z-30">
                          Nama PCL
                        </th>
                        <th colSpan={7} className="py-2 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold tracking-wide uppercase">
                          Skala Prelist
                        </th>
                        <th rowSpan={2} className="px-4 py-4 text-sm font-extrabold uppercase">
                          Total
                        </th>
                      </tr>
                      {/* Sub Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold">
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Keluarga</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMK</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM Bangunan Lain</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UM</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UB</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Dummy</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Keluarga</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredPclStats.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                            Tidak ada data PCL ditemukan untuk filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredPclStats.map((pcl, idx) => (
                          <tr 
                            key={idx} 
                            className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800"
                          >
                            {/* PCL Name cell */}
                            <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                              <div>{pcl.nama}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{pcl.kec}</div>
                            </td>

                            {/* Category cells */}
                            {categories.map((cat, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                                <CellContent stats={pcl.categories[cat]} />
                              </td>
                            ))}

                            {/* Total cell */}
                            <td className="p-2 align-top bg-orange-500/5 dark:bg-orange-500/0">
                              <CellContent stats={pcl.total} highlight={true} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : activeTab === "pml" ? (
                  // =================== TABLE 3: DETAIL PML ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 min-w-[1200px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      {/* Top Header Row */}
                      <tr className="bg-orange-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold text-left w-56 sticky left-0 bg-orange-100 dark:bg-slate-800 z-30">
                          Nama PML (Pengawas)
                        </th>
                        <th colSpan={7} className="py-2 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold tracking-wide uppercase">
                          Skala Prelist
                        </th>
                        <th rowSpan={2} className="px-4 py-4 text-sm font-extrabold uppercase">
                          Total
                        </th>
                      </tr>
                      {/* Sub Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold">
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Keluarga</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMK</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM Bangunan Lain</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UM</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UB</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Dummy</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Keluarga</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredPmlStats.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                            Tidak ada data PML ditemukan untuk filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredPmlStats.map((pml, idx) => (
                          <tr 
                            key={idx} 
                            className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800"
                          >
                            {/* PML Name cell */}
                            <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                              <div>{pml.nama}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{pml.kec}</div>
                            </td>

                            {/* Category cells */}
                            {categories.map((cat, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                                <CellContent stats={pml.categories[cat]} />
                              </td>
                            ))}

                            {/* Total cell */}
                            <td className="p-2 align-top bg-orange-500/5 dark:bg-orange-500/0">
                              <CellContent stats={pml.total} highlight={true} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : activeTab === "sls" ? (
                  // =================== TABLE 4: DETAIL SLS ===================
                  <>
                    <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 min-w-[1200px]">
                      <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                        {/* Top Header Row */}
                        <tr className="bg-orange-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                          <th rowSpan={2} className="px-4 py-4 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold text-left w-56 sticky left-0 bg-orange-100 dark:bg-slate-800 z-30">
                            Kode SLS (14 Digit)
                          </th>
                          <th colSpan={7} className="py-2 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold tracking-wide uppercase">
                            Skala Prelist
                          </th>
                          <th rowSpan={2} className="px-4 py-4 text-sm font-extrabold uppercase">
                            Total
                          </th>
                        </tr>
                        {/* Sub Header Row */}
                        <tr className="bg-slate-100/90 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold">
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Keluarga</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMK</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM Bangunan Lain</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UM</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UB</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Dummy</th>
                          <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Keluarga</th>
                        </tr>
                      </thead>
                      
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {paginatedSlsStats.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                              Tidak ada data SLS ditemukan untuk filter ini.
                            </td>
                          </tr>
                        ) : (
                          paginatedSlsStats.map((sls, idx) => (
                            <tr 
                              key={idx} 
                              className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800 ${
                                sls.isPrioritas 
                                  ? "bg-orange-500/5 hover:bg-orange-500/10 dark:bg-orange-500/5 dark:hover:bg-orange-500/10" 
                                  : ""
                              }`}
                            >
                              {/* SLS Code cell */}
                              <td className={`px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-bold sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] transition-colors ${
                                sls.isPrioritas
                                  ? "bg-orange-50/90 dark:bg-orange-950/20 text-orange-900 dark:text-orange-300 border-l-2 border-l-orange-500 group-hover:bg-orange-100/90 dark:group-hover:bg-orange-950/40"
                                  : "bg-white dark:bg-slate-900 text-slate-950 dark:text-white border-l-2 border-l-transparent group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-sm tracking-wider">{sls.slsCode}</span>
                                  {sls.isPrioritas && (
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-orange-500 text-white dark:bg-orange-600 tracking-wider">
                                      Prioritas
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{sls.kec} • Koseka: {sls.koseka}</div>
                              </td>

                              {/* Category cells */}
                              {categories.map((cat, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                                  <CellContent stats={sls.categories[cat]} />
                                </td>
                              ))}

                              {/* Total cell */}
                              <td className="p-2 align-top bg-orange-500/5 dark:bg-orange-500/0">
                                <CellContent stats={sls.total} highlight={true} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {filteredSlsStats.length > 0 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          Menampilkan <span className="font-bold text-slate-900 dark:text-white">{Math.min((slsPage - 1) * slsPerPage + 1, filteredSlsStats.length)}</span> - <span className="font-bold text-slate-900 dark:text-white">{Math.min(slsPage * slsPerPage, filteredSlsStats.length)}</span> dari <span className="font-bold text-slate-900 dark:text-white">{filteredSlsStats.length}</span> SLS
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSlsPage(prev => Math.max(prev - 1, 1))}
                            disabled={slsPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            Sebelumnya
                          </button>
                          {Array.from({ length: Math.min(5, totalSlsPages) }, (_, i) => {
                            let pageNum = slsPage;
                            if (slsPage <= 3) {
                              pageNum = i + 1;
                            } else if (slsPage >= totalSlsPages - 2) {
                              pageNum = totalSlsPages - 4 + i;
                            } else {
                              pageNum = slsPage - 2 + i;
                            }
                            if (pageNum < 1 || pageNum > totalSlsPages) return null;

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setSlsPage(pageNum)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  slsPage === pageNum
                                    ? "bg-orange-500 text-white shadow-sm"
                                    : "border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setSlsPage(prev => Math.min(prev + 1, totalSlsPages))}
                            disabled={slsPage === totalSlsPages}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            Selanjutnya
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : activeTab === "sumber_data" ? (
                  // =================== TABLE 5: SUMBER DATA ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 min-w-[1200px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      {/* Top Header Row */}
                      <tr className="bg-orange-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold text-left w-56 sticky left-0 bg-orange-100 dark:bg-slate-800 z-30">
                          Sumber Data
                        </th>
                        <th colSpan={7} className="py-2 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold tracking-wide uppercase">
                          Skala Prelist
                        </th>
                        <th rowSpan={2} className="px-4 py-4 text-sm font-extrabold uppercase">
                          Total
                        </th>
                      </tr>
                      {/* Sub Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold">
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Keluarga</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMK</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM Bangunan Lain</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UM</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UB</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Dummy</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Keluarga</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredSumberDataStats.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                            Tidak ada data Sumber Data ditemukan untuk filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredSumberDataStats.map((sumber, idx) => (
                          <tr 
                            key={idx} 
                            className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800"
                          >
                            {/* Sumber Data Name cell */}
                            <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] font-mono">
                              <div>{sumber.kecName}</div>
                            </td>

                            {/* Category cells */}
                            {categories.map((cat, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                                <CellContent stats={sumber.categories[cat]} />
                              </td>
                            ))}

                            {/* Total cell */}
                            <td className="p-2 align-top bg-orange-500/5 dark:bg-orange-500/0">
                              <CellContent stats={sumber.total} highlight={true} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  // =================== TABLE 2: KECAMATAN OVERVIEW ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 min-w-[1200px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      {/* Top Header Row */}
                      <tr className="bg-orange-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold text-left w-56 sticky left-0 bg-orange-100 dark:bg-slate-800 z-30">
                          Nama Kecamatan
                        </th>
                        <th colSpan={7} className="py-2 border-r border-slate-200 dark:border-slate-700 text-sm font-extrabold tracking-wide uppercase">
                          Skala Prelist
                        </th>
                        <th rowSpan={2} className="px-4 py-4 text-sm font-extrabold uppercase">
                          Total
                        </th>
                      </tr>
                      {/* Sub Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold">
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Keluarga</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMK</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM Bangunan Lain</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UM</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UB</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Dummy</th>
                        <th className="px-2 py-2.5 border-r border-slate-200 dark:border-slate-700 w-36">UMKM/Keluarga</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {kecamatanStats.map((kec, idx) => (
                        <tr 
                          key={idx} 
                          className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800"
                        >
                          {/* Kecamatan Name cell */}
                          <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-950 dark:text-white sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                            <div>{kec.kecName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">Koseka: {kec.koseka}</div>
                          </td>

                          {/* Category cells */}
                          {categories.map((cat, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                              <CellContent stats={kec.categories[cat]} />
                            </td>
                          ))}

                          {/* Total cell */}
                          <td className="p-2 align-top bg-orange-500/5 dark:bg-orange-500/0">
                            <CellContent stats={kec.total} highlight={true} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-medium">
          <p>© 2026 Badan Pusat Statistik (BPS) Kabupaten Kepulauan Sangihe. Hak Cipta Dilindungi.</p>
          <p>
            Pengembang:{" "}
            <a
              href="http://hamdani-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Hamdani
            </a>
          </p>
        </div>
      </footer>

    </div>
  );
}
