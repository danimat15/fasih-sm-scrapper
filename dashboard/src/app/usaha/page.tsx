"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import {
  Search,
  User,
  MapPin,
  Building,
  CheckCircle2,
  Moon,
  Sun,
  Download,
  RefreshCw,
  Layers,
  ChevronDown,
  X,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Send,
  XCircle,
  AlertCircle,
  ClipboardList,
  Clock,
  ChevronLeft,
  FileText
} from "lucide-react";

// Interfaces
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
  notes: string;
}

interface PMLPPLRecord {
  nama_petugas: string;
  kec: string;
  jabatan_petugas: string; // 'PML' or 'PPL'
  email: string;
}

interface UsahaStats {
  submit: number;
  approve: number;
  total: number;
}

interface UserUsahaRow {
  nama: string;
  email: string;
  jabatan: string;
  kec: string;
  submit: number;
  approve: number;
  total: number;
}

interface SlsUsahaRow {
  slsCode: string;
  kec: string;
  koseka: string;
  isPrioritas: boolean;
  submit: number;
  approve: number;
  total: number;
}

interface KecUsahaRow {
  kecName: string;
  koseka: string;
  submit: number;
  approve: number;
  total: number;
}

export default function UsahaPage() {
  const [rawData, setRawData] = useState<ScraperRecord[]>([]);
  const [pmlPplData, setPmlPplData] = useState<PMLPPLRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");



  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"user" | "sls" | "kec" | "detail">("user");
  const [selectedKec, setSelectedKec] = useState<string>("all");
  const [selectedSumberData, setSelectedSumberData] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [slsPage, setSlsPage] = useState(1);
  const slsPerPage = 25;
  const [detailPage, setDetailPage] = useState(1);
  const detailPerPage = 25;

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
    setSlsPage(1);
    setDetailPage(1);
  }, [selectedKec, selectedSumberData, selectedStatus, searchQuery, activeTab]);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dataResponse = await fetch("/update_data.csv");
      if (!dataResponse.ok) {
        throw new Error("Gagal mengambil file update_data.csv.");
      }
      const dataText = await dataResponse.text();

      const pmlPplResponse = await fetch("/pml_ppl.csv");
      if (!pmlPplResponse.ok) {
        throw new Error("Gagal mengambil file pml_ppl.csv.");
      }
      const pmlPplText = await pmlPplResponse.text();

      // Simple CSV parsing
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
              scale: row[7].replace(/"/g, "").trim(),
              jumlahUsaha: isNaN(parsedJU) ? 0 : parsedJU,
              status: row[12].replace(/"/g, "").trim(),
              officer: row[14].replace(/"/g, "").trim(),
              sumberData: row[16] ? row[16].replace(/"/g, "").trim() : "",
              nama_kec: row[17] ? row[17].replace(/"/g, "").trim() : "",
              koseka: row[18] ? row[18].replace(/"/g, "").trim() : "",
              isPrioritas: row[19] ? row[19].replace(/"/g, "").trim() : "Tidak",
              notes: row[15] ? row[15].replace(/"/g, "").trim() : "",
            });
          }
        }
        return parsed;
      };

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

      setRawData(parseDataCSV(dataText));
      setPmlPplData(parsePMLPPL(pmlPplText));

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

  // Format Helper
  const formatKecName = (name: string): string => {
    if (!name) return "";
    let cleaned = name.replace(/\(\d+\)/g, "").trim();
    return cleaned
      .toLowerCase()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const normalizeKec = (name: string): string => {
    if (!name) return "";
    return name.replace(/\(\d+\)/g, "").trim().toUpperCase();
  };

  // Lists
  const uniqueKecList = useMemo(() => {
    const fromRaw = rawData.map(r => formatKecName(r.nama_kec)).filter(Boolean);
    const fromPmlPpl = pmlPplData.map(item => formatKecName(item.kec)).filter(Boolean);
    return Array.from(new Set([...fromRaw, ...fromPmlPpl])).sort();
  }, [rawData, pmlPplData]);

  const uniqueSumberDataList = useMemo(() => {
    return Array.from(new Set(rawData.map(r => r.sumberData).filter(Boolean))).sort();
  }, [rawData]);

  const uniqueStatusList = useMemo(() => {
    const statusMap: { [key: string]: string } = {};
    rawData.forEach(r => {
      const s = r.status.toLowerCase().trim();
      if (!s || s === "kosong") {
        statusMap["belum_diisi"] = "Belum Diisi";
      } else if (s === "open") {
        statusMap["open"] = "Terbuka (Open)";
      } else if (s === "draft") {
        statusMap["draft"] = "Draft";
      } else if (s === "submitted by pencacah" || s === "submit" || s === "submitted") {
        statusMap["submitted"] = "Submitted by Pencacah";
      } else if (s === "rejected by pengawas" || s === "reject" || s === "rejected") {
        statusMap["rejected"] = "Rejected by Pengawas";
      } else if (s === "approved by pengawas" || s === "approve" || s === "approved") {
        statusMap["approved"] = "Approved by Pengawas";
      } else if (s === "revoked by pengawas" || s === "revoked") {
        statusMap["revoked"] = "Revoked by Pengawas";
      } else if (s === "rejected by admin kabupaten") {
        statusMap["rejected_admin"] = "Rejected by Admin Kabupaten";
      } else if (s === "submitted respondent") {
        statusMap["submitted_respondent"] = "Submitted Respondent";
      } else if (s === "completed by admin kabupaten") {
        statusMap["completed_admin"] = "Completed by Admin Kabupaten";
      } else if (s === "edited by admin kabupaten") {
        statusMap["edited_admin"] = "Edited by Admin Kabupaten";
      } else {
        statusMap[s] = r.status;
      }
    });
    return Object.entries(statusMap).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rawData]);

  // Table calculations
  // 1. User/Officer Table
  const userUsahaStats = useMemo<UserUsahaRow[]>(() => {
    return pmlPplData.map(officer => {
      const email = officer.email.toLowerCase();
      const isPpl = officer.jabatan_petugas === "PPL";

      let submitCount = 0;
      let approveCount = 0;

      if (isPpl) {
        // Direct matching for PPL (PCL)
        const records = rawData.filter(r => r.searchedEmail === email);
        records.forEach(r => {
          const status = r.status.toLowerCase().trim();
          const isSubmit = status === "submitted by pencacah" || status === "submit" || status === "submitted";
          const isApprove = status === "approved by pengawas" || status === "approve" || status === "approved";
          
          if (isSubmit) submitCount += r.jumlahUsaha;
          if (isApprove) approveCount += r.jumlahUsaha;
        });
      } else {
        // PML PML matches PPLs of same kecamatan
        const normalizedKecName = normalizeKec(officer.kec);
        const pplEmails = new Set(
          pmlPplData
            .filter(item => item.jabatan_petugas === "PPL" && normalizeKec(item.kec) === normalizedKecName)
            .map(ppl => ppl.email.toLowerCase())
        );

        const records = rawData.filter(r => pplEmails.has(r.searchedEmail) || normalizeKec(r.nama_kec) === normalizedKecName);
        records.forEach(r => {
          const status = r.status.toLowerCase().trim();
          const isSubmit = status === "submitted by pencacah" || status === "submit" || status === "submitted";
          const isApprove = status === "approved by pengawas" || status === "approve" || status === "approved";

          if (isSubmit) submitCount += r.jumlahUsaha;
          if (isApprove) approveCount += r.jumlahUsaha;
        });
      }

      return {
        nama: officer.nama_petugas,
        email: officer.email,
        jabatan: officer.jabatan_petugas,
        kec: officer.kec,
        submit: submitCount,
        approve: approveCount,
        total: submitCount + approveCount
      };
    }).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rawData, pmlPplData]);

  const filteredUserUsahaStats = useMemo(() => {
    return userUsahaStats.filter(row => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(row.kec) === normalizeKec(selectedKec);
      if (!matchKec) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return row.nama.toLowerCase().includes(q) || row.email.toLowerCase().includes(q) || row.kec.toLowerCase().includes(q);
    });
  }, [userUsahaStats, selectedKec, searchQuery]);

  // 2. SLS Table
  const slsUsahaStats = useMemo<SlsUsahaRow[]>(() => {
    const slsMap: { [code: string]: SlsUsahaRow } = {};

    rawData.forEach(r => {
      const digits = r.idCode.replace(/\D/g, "");
      if (digits.length < 14) return;
      const slsCode = digits.substring(0, 14);

      if (!slsMap[slsCode]) {
        slsMap[slsCode] = {
          slsCode,
          kec: formatKecName(r.nama_kec),
          koseka: r.koseka || "-",
          isPrioritas: r.isPrioritas === "Ya",
          submit: 0,
          approve: 0,
          total: 0
        };
      }

      const status = r.status.toLowerCase().trim();
      const isSubmit = status === "submitted by pencacah" || status === "submit" || status === "submitted";
      const isApprove = status === "approved by pengawas" || status === "approve" || status === "approved";

      if (isSubmit) slsMap[slsCode].submit += r.jumlahUsaha;
      if (isApprove) slsMap[slsCode].approve += r.jumlahUsaha;
      slsMap[slsCode].total = slsMap[slsCode].submit + slsMap[slsCode].approve;
    });

    return Object.values(slsMap).sort((a, b) => a.slsCode.localeCompare(b.slsCode));
  }, [rawData]);

  const filteredSlsUsahaStats = useMemo(() => {
    return slsUsahaStats.filter(row => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(row.kec) === normalizeKec(selectedKec);
      if (!matchKec) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return row.slsCode.includes(q) || row.kec.toLowerCase().includes(q) || row.koseka.toLowerCase().includes(q);
    });
  }, [slsUsahaStats, selectedKec, searchQuery]);

  const paginatedSlsUsahaStats = useMemo(() => {
    const start = (slsPage - 1) * slsPerPage;
    return filteredSlsUsahaStats.slice(start, start + slsPerPage);
  }, [filteredSlsUsahaStats, slsPage]);

  const totalSlsPages = Math.ceil(filteredSlsUsahaStats.length / slsPerPage) || 1;

  // 3. Kecamatan Table
  const kecUsahaStats = useMemo<KecUsahaRow[]>(() => {
    const statsMap: { [name: string]: KecUsahaRow } = {};

    uniqueKecList.forEach(kec => {
      const normalizedKecName = normalizeKec(kec);
      const record = rawData.find(r => normalizeKec(r.nama_kec) === normalizedKecName);
      const kosekaName = record ? record.koseka : "-";

      statsMap[kec] = {
        kecName: kec,
        koseka: kosekaName,
        submit: 0,
        approve: 0,
        total: 0
      };

      // Aggregate all matching records for this subdistrict
      const pplsInKec = pmlPplData.filter(item => item.jabatan_petugas === "PPL" && normalizeKec(item.kec) === normalizedKecName);
      const emailsInKec = new Set(pplsInKec.map(ppl => ppl.email.toLowerCase()));

      const records = rawData.filter(r => emailsInKec.has(r.searchedEmail) || normalizeKec(r.nama_kec) === normalizedKecName);
      records.forEach(r => {
        const status = r.status.toLowerCase().trim();
        const isSubmit = status === "submitted by pencacah" || status === "submit" || status === "submitted";
        const isApprove = status === "approved by pengawas" || status === "approve" || status === "approved";

        if (isSubmit) statsMap[kec].submit += r.jumlahUsaha;
        if (isApprove) statsMap[kec].approve += r.jumlahUsaha;
        statsMap[kec].total = statsMap[kec].submit + statsMap[kec].approve;
      });
    });

    return Object.values(statsMap).sort((a, b) => a.kecName.localeCompare(b.kecName));
  }, [rawData, pmlPplData, uniqueKecList]);

  const filteredKecUsahaStats = useMemo(() => {
    return kecUsahaStats.filter(row => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return row.kecName.toLowerCase().includes(q) || row.koseka.toLowerCase().includes(q);
    });
  }, [kecUsahaStats, searchQuery]);

  // 4. Detail Table (Data Lengkap)
  const filteredDetailStats = useMemo(() => {
    return rawData.filter(row => {
      const matchKec = selectedKec === "all" ? true : normalizeKec(row.nama_kec) === normalizeKec(selectedKec);
      if (!matchKec) return false;

      const matchSumber = selectedSumberData === "all" ? true : row.sumberData === selectedSumberData;
      if (!matchSumber) return false;

      // Status filter
      if (selectedStatus !== "all") {
        const s = row.status.toLowerCase().trim();
        let statusKey = s;
        if (!s || s === "kosong") statusKey = "belum_diisi";
        else if (s === "submitted by pencacah" || s === "submit" || s === "submitted") statusKey = "submitted";
        else if (s === "rejected by pengawas" || s === "reject" || s === "rejected") statusKey = "rejected";
        else if (s === "approved by pengawas" || s === "approve" || s === "approved") statusKey = "approved";
        else if (s === "revoked by pengawas" || s === "revoked") statusKey = "revoked";
        else if (s === "rejected by admin kabupaten") statusKey = "rejected_admin";
        else if (s === "submitted respondent") statusKey = "submitted_respondent";
        else if (s === "completed by admin kabupaten") statusKey = "completed_admin";
        else if (s === "edited by admin kabupaten") statusKey = "edited_admin";
        if (statusKey !== selectedStatus) return false;
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.idCode.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.address.toLowerCase().includes(q) ||
        row.officer.toLowerCase().includes(q) ||
        (row.notes && row.notes.toLowerCase().includes(q))
      );
    });
  }, [rawData, selectedKec, selectedSumberData, selectedStatus, searchQuery]);

  const paginatedDetailStats = useMemo(() => {
    const start = (detailPage - 1) * detailPerPage;
    return filteredDetailStats.slice(start, start + detailPerPage);
  }, [filteredDetailStats, detailPage]);

  const totalDetailPageCount = Math.ceil(filteredDetailStats.length / detailPerPage) || 1;

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
  }, [rawData, paginatedDetailStats, detailPage, activeTab]);

  // Overall totals
  const totalSummary = useMemo(() => {
    let submitTotal = 0;
    let approveTotal = 0;

    // Use rawData to get overall true total
    rawData.forEach(r => {
      const status = r.status.toLowerCase().trim();
      const isSubmit = status === "submitted by pencacah" || status === "submit" || status === "submitted";
      const isApprove = status === "approved by pengawas" || status === "approve" || status === "approved";

      if (isSubmit) submitTotal += r.jumlahUsaha;
      if (isApprove) approveTotal += r.jumlahUsaha;
    });

    return {
      submit: submitTotal,
      approve: approveTotal,
      total: submitTotal + approveTotal
    };
  }, [rawData]);

  // CSV Export
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `monitoring_usaha_${activeTab}_${Date.now()}.csv`;

    if (activeTab === "user") {
      headers = ["Nama Petugas", "Email", "Jabatan", "Kecamatan", "Jumlah Usaha Submit", "Jumlah Usaha Approve", "Total Usaha"];
      rows = filteredUserUsahaStats.map(r => [
        `"${r.nama}"`,
        `"${r.email}"`,
        `"${r.jabatan}"`,
        `"${formatKecName(r.kec)}"`,
        r.submit,
        r.approve,
        r.total
      ]);
    } else if (activeTab === "sls") {
      headers = ["Kode SLS", "Kecamatan", "Koseka", "Prioritas", "Jumlah Usaha Submit", "Jumlah Usaha Approve", "Total Usaha"];
      rows = filteredSlsUsahaStats.map(r => [
        `"${r.slsCode}"`,
        `"${formatKecName(r.kec)}"`,
        `"${r.koseka}"`,
        r.isPrioritas ? "Ya" : "Tidak",
        r.submit,
        r.approve,
        r.total
      ]);
    } else if (activeTab === "kec") {
      headers = ["Nama Kecamatan", "Koseka", "Jumlah Usaha Submit", "Jumlah Usaha Approve", "Total Usaha"];
      rows = filteredKecUsahaStats.map(r => [
        `"${formatKecName(r.kecName)}"`,
        `"${r.koseka}"`,
        r.submit,
        r.approve,
        r.total
      ]);
    } else {
      // activeTab === "detail" (Data Lengkap)
      headers = [
        "Kode Identitas", "Sumber Data", "Nama Keluarga/Bangunan/Usaha", "Kecamatan", "Koseka", "Alamat Prelist", 
        "Skala Usaha", "Jumlah Usaha", "Status", "Petugas Saat Ini", "Keterangan", "Prioritas"
      ];
      rows = filteredDetailStats.map(r => [
        `"${r.idCode.replace(/"/g, '""')}"`,
        `"${(r.sumberData || "").replace(/"/g, '""')}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${(r.nama_kec || "").replace(/"/g, '""')}"`,
        `"${(r.koseka || "").replace(/"/g, '""')}"`,
        `"${r.address.replace(/"/g, '""')}"`,
        `"${r.scale.replace(/"/g, '""')}"`,
        r.jumlahUsaha,
        `"${r.status.replace(/"/g, '""')}"`,
        `"${r.officer.replace(/"/g, '""')}"`,
        `"${(r.notes || "").replace(/"/g, '""')}"`,
        `"${(r.isPrioritas || "Tidak").replace(/"/g, '""')}"`
      ]);
    }

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    const s = status.toLowerCase().trim();
    if (s === "open") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          Terbuka (Open)
        </span>
      );
    } else if (s === "draft") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20">
          <FileText className="w-3.5 h-3.5" />
          Draft
        </span>
      );
    } else if (s === "submitted by pencacah" || s === "submit" || s === "submitted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-500 border border-teal-500/20">
          <Send className="w-3.5 h-3.5" />
          Submitted by Pencacah
        </span>
      );
    } else if (s === "rejected by pengawas" || s === "reject" || s === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Rejected by Pengawas
        </span>
      );
    } else if (s === "rejected by admin kabupaten") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Rejected by Admin Kabupaten
        </span>
      );
    } else if (s === "approved by pengawas" || s === "approve" || s === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approved by Pengawas
        </span>
      );
    } else if (s === "completed by admin kabupaten") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 border border-indigo-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed by Admin Kabupaten
        </span>
      );
    } else if (s === "edited by admin kabupaten") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-500 border border-violet-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Edited by Admin Kabupaten
        </span>
      );
    } else if (s === "submitted respondent") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-500 border border-cyan-500/20">
          <Send className="w-3.5 h-3.5" />
          Submitted Respondent
        </span>
      );
    } else if (s === "revoked by pengawas" || s === "revoked") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-450 border border-purple-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Revoked by Pengawas
        </span>
      );
    } else if (s === "kosong" || s === "") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Belum Diisi
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          {status}
        </span>
      );
    }
  };

  // Scale Badge Component
  const ScaleBadge = ({ scale }: { scale: string }) => {
    const s = scale.toUpperCase();
    let colorClass = "bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20";
    if (s.includes("KELUARGA")) {
      colorClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
    } else if (s.includes("UMK")) {
      colorClass = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20";
    } else if (s.includes("UMKM")) {
      colorClass = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
    }
    
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${colorClass}`}>
        {scale}
      </span>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      <Navbar />

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Title */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-5 sm:p-10 text-white shadow-xl shadow-orange-600/10 mb-8">
          <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-20 -translate-y-20"></div>
          <div className="absolute right-1/4 bottom-0 w-60 h-60 rounded-full bg-orange-400/20 blur-2xl translate-y-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/20 text-white mb-2 inline-block">
                Monitoring Jumlah Usaha
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                Rekapitulasi Jumlah Usaha
              </h2>
              <p className="text-xs sm:text-base md:text-lg text-orange-50 max-w-2xl font-light">
                Monitoring total jumlah usaha dengan status **SUBMITTED** dan **APPROVED** per Petugas, SLS, dan Kecamatan.
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

        {/* Loading/Error state */}
        {loading && rawData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-sm">
              Mengekstrak dan Memproses Data Usaha BPS FASIH...
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
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto scrollbar-none flex-nowrap min-w-0 w-full">
              <button
                onClick={() => { setActiveTab("user"); setSelectedKec("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "user"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <User className="w-4 h-4" />
                Rekap per Petugas
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
                Rekap per SLS
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
                Rekap per Kecamatan
              </button>
              <button
                onClick={() => { setActiveTab("detail"); setSelectedKec("all"); setSelectedSumberData("all"); setSelectedStatus("all"); }}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  activeTab === "detail"
                    ? "border-orange-500 text-orange-500 dark:text-orange-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Data Lengkap
              </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
                  
                  {/* Kecamatan Dropdown */}
                  {(activeTab === "user" || activeTab === "sls" || activeTab === "detail") && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold w-full sm:w-auto">
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
                  )}

                  {/* Sumber Data Dropdown */}
                  {activeTab === "detail" && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold w-full sm:w-auto">
                      <FileText className="w-4 h-4 text-orange-500" />
                      <select
                        value={selectedSumberData}
                        onChange={(e) => setSelectedSumberData(e.target.value)}
                        className="w-full sm:w-auto py-2.5 px-3.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold cursor-pointer"
                      >
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Sumber Data</option>
                        {uniqueSumberDataList.map((sd, idx) => (
                          <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={idx} value={sd}>{sd}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Status Dropdown */}
                  {activeTab === "detail" && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold w-full sm:w-auto">
                      <CheckCircle2 className="w-4 h-4 text-orange-500" />
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full sm:w-auto py-2.5 px-3.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold cursor-pointer"
                      >
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Status</option>
                        {uniqueStatusList.map(([key, label], idx) => (
                          <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={idx} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <input
                      type="text"
                      placeholder={
                        activeTab === "user" 
                          ? "Cari nama petugas..." 
                          : activeTab === "sls" 
                            ? "Cari kode SLS..." 
                            : activeTab === "detail"
                              ? "Cari nama, ID prelist, alamat, atau petugas..."
                              : "Cari kecamatan..."
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
                </div>

                <button
                  onClick={handleExportCSV}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-950 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4 text-orange-500" />
                  <span>Ekspor CSV</span>
                </button>
              </div>

              {/* Progress Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold block uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    Total Usaha Submit
                  </span>
                  <span className="text-lg sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
                    {totalSummary.submit.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold block uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Total Usaha Approve
                  </span>
                  <span className="text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {totalSummary.approve.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-900/50">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold block uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                    Total Usaha (Submit & Approve)
                  </span>
                  <span className="text-lg sm:text-2xl font-extrabold text-orange-600 dark:text-orange-400 mt-1 block">
                    {totalSummary.total.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* Content Tables */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg overflow-hidden">
              
              {/* Top scrollbar synced with table (only for detail tab) */}
              {activeTab === "detail" && (
                <div 
                  ref={topScrollRef}
                  onScroll={handleTopScroll}
                  className="hidden md:block overflow-x-auto overflow-y-hidden w-full bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800"
                  style={{ height: "10px" }}
                >
                  <div style={{ width: `${tableWidth}px`, height: "10px" }} />
                </div>
              )}

              <div 
                ref={activeTab === "detail" ? tableContainerRef : undefined}
                onScroll={activeTab === "detail" ? handleTableScroll : undefined}
                className="overflow-auto max-h-[700px] w-full"
              >
                
                {activeTab === "user" && (
                  // =================== TABLE 1: USER USASHA ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-left min-w-[800px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      <tr className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                        <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Petugas</th>
                        <th className="py-4 px-4 text-center">No</th>
                        <th className="py-4 px-4">Jabatan</th>
                        <th className="py-4 px-4">Kecamatan</th>
                        <th className="py-4 px-4 text-center">Usaha Submit</th>
                        <th className="py-4 px-4 text-center">Usaha Approve</th>
                        <th className="py-4 px-4 text-center">Total Usaha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {filteredUserUsahaStats.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-16 text-center text-slate-700 dark:text-slate-300 font-medium">
                            Tidak ada data petugas ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredUserUsahaStats.map((row, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800">
                            <td className="py-3 px-4 font-bold sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                              <div>{row.nama}</div>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 font-normal mt-0.5">{row.email}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                row.jabatan === "PML" 
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" 
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              }`}>
                                {row.jabatan}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-normal">{formatKecName(row.kec)}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-500">{row.submit.toLocaleString("id-ID")}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-550">{row.approve.toLocaleString("id-ID")}</td>
                            <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-950/20">{row.total.toLocaleString("id-ID")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "sls" && (
                  // =================== TABLE 2: SLS USASHA ===================
                  <>
                    <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-left min-w-[800px]">
                      <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                        <tr className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Kode SLS</th>
                          <th className="py-4 px-4 text-center">No</th>
                          <th className="py-4 px-4">Kecamatan</th>
                          <th className="py-4 px-4">Koseka</th>
                          <th className="py-4 px-4 text-center">Usaha Submit</th>
                          <th className="py-4 px-4 text-center">Usaha Approve</th>
                          <th className="py-4 px-4 text-center">Total Usaha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {paginatedSlsUsahaStats.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-16 text-center text-slate-700 dark:text-slate-300 font-medium">
                              Tidak ada data SLS ditemukan.
                            </td>
                          </tr>
                        ) : (
                          paginatedSlsUsahaStats.map((row, idx) => (
                            <tr 
                              key={idx} 
                              className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800 ${
                                row.isPrioritas ? "bg-orange-50/50 dark:bg-orange-950/20" : ""
                              }`}
                            >
                              <td className={`py-3 px-4 font-mono font-bold sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] transition-colors ${
                                row.isPrioritas
                                  ? "bg-orange-50/90 dark:bg-orange-950/20 text-orange-900 dark:text-orange-300 group-hover:bg-orange-100/90 dark:group-hover:bg-orange-950/40"
                                  : "bg-white dark:bg-slate-900 text-slate-950 dark:text-white group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <span>{row.slsCode}</span>
                                  {row.isPrioritas && (
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-orange-500 text-white tracking-wider">Prio</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                                {(slsPage - 1) * slsPerPage + idx + 1}
                              </td>
                              <td className="py-3 px-4 font-normal">{formatKecName(row.kec)}</td>
                              <td className="py-3 px-4 font-normal">{row.koseka}</td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-500">{row.submit.toLocaleString("id-ID")}</td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-550">{row.approve.toLocaleString("id-ID")}</td>
                              <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-950/20">{row.total.toLocaleString("id-ID")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredSlsUsahaStats.length > 0 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          Menampilkan <span className="font-bold text-slate-900 dark:text-white">{Math.min((slsPage - 1) * slsPerPage + 1, filteredSlsUsahaStats.length)}</span> - <span className="font-bold text-slate-900 dark:text-white">{Math.min(slsPage * slsPerPage, filteredSlsUsahaStats.length)}</span> dari <span className="font-bold text-slate-900 dark:text-white">{filteredSlsUsahaStats.length}</span> SLS
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSlsPage(prev => Math.max(prev - 1, 1))}
                            disabled={slsPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            Sebelumnya
                          </button>
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
                )}

                {activeTab === "kec" && (
                  // =================== TABLE 3: KECAMATAN USASHA ===================
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-left min-w-[700px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                      <tr className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                        <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Kecamatan</th>
                        <th className="py-4 px-4 text-center">No</th>
                        <th className="py-4 px-4">Koseka</th>
                        <th className="py-4 px-4 text-center">Usaha Submit</th>
                        <th className="py-4 px-4 text-center">Usaha Approve</th>
                        <th className="py-4 px-4 text-center">Total Usaha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {filteredKecUsahaStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-16 text-center text-slate-700 dark:text-slate-300 font-medium">
                            Tidak ada data kecamatan ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredKecUsahaStats.map((row, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800">
                            <td className="py-3 px-4 font-bold sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors z-10 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                              {formatKecName(row.kecName)}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">{idx + 1}</td>
                            <td className="py-3 px-4 font-normal">{row.koseka}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-500">{row.submit.toLocaleString("id-ID")}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-550">{row.approve.toLocaleString("id-ID")}</td>
                            <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-950/20">{row.total.toLocaleString("id-ID")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "detail" && (
                  // =================== TABLE 4: DETAIL DATA (DATA LENGKAP) ===================
                  <>
                    <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-left min-w-[1200px]">
                      <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                        <tr className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap sticky left-0 z-30 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Kode Identitas</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Sumber Data</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Nama Keluarga/Bangunan/Usaha</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Kecamatan</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Koseka</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Alamat Prelist</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Skala Prelist</th>
                          <th className="py-4 px-4 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Jumlah Usaha</th>
                          <th className="py-4 px-4 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Status</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Petugas</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-xs">
                        {paginatedDetailStats.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="px-4 py-16 text-center text-slate-700 dark:text-slate-300 font-medium">
                              Tidak ditemukan data yang cocok dengan kriteria pencarian dan filter Anda.
                            </td>
                          </tr>
                        ) : (
                          paginatedDetailStats.map((row, idx) => (
                            <tr
                              key={idx}
                              className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all border-b border-slate-100 dark:border-slate-800 border-l-2 ${
                                row.isPrioritas === "Ya"
                                  ? "bg-orange-500/5 hover:bg-orange-500/10 dark:bg-orange-500/5 dark:hover:bg-orange-500/10 border-l-orange-500"
                                  : "border-l-transparent"
                              }`}
                            >
                              {/* ID Code */}
                              <td className={`py-3 px-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-300 whitespace-nowrap sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] transition-colors ${
                                row.isPrioritas === "Ya"
                                  ? "bg-orange-50/90 dark:bg-slate-950/20 group-hover:bg-orange-100/90 dark:group-hover:bg-orange-950/30"
                                  : "bg-white dark:bg-slate-900 text-slate-950 dark:text-white group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span>{row.idCode}</span>
                                  {row.isPrioritas === "Ya" && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 tracking-wider shadow-sm animate-pulse">
                                      Prioritas
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* Sumber Data */}
                              <td className="py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-300 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {row.sumberData || "-"}
                                </span>
                              </td>
                              {/* Name */}
                              <td className="py-3 px-4 font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                                {row.name || "-"}
                              </td>
                              {/* Kecamatan */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                                {formatKecName(row.nama_kec)}
                              </td>
                              {/* Koseka */}
                              <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                                {row.koseka || "-"}
                              </td>
                              {/* Address */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                                {row.address || "-"}
                              </td>
                              {/* Scale */}
                              <td className="py-3 px-4">
                                <ScaleBadge scale={row.scale} />
                              </td>
                              {/* Jumlah Usaha */}
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-850 dark:text-slate-200">
                                {row.jumlahUsaha || "-"}
                              </td>
                              {/* Status */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <StatusBadge status={row.status} />
                              </td>
                              {/* Officer */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px]">
                                {row.officer ? row.officer.replace(/Pencacah$/, "") : "-"}
                              </td>
                              {/* Notes */}
                              <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                {row.notes || "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredDetailStats.length > 0 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          Menampilkan <span className="font-bold text-slate-900 dark:text-white">{Math.min((detailPage - 1) * detailPerPage + 1, filteredDetailStats.length)}</span> - <span className="font-bold text-slate-900 dark:text-white">{Math.min(detailPage * detailPerPage, filteredDetailStats.length)}</span> dari <span className="font-bold text-slate-900 dark:text-white">{filteredDetailStats.length.toLocaleString("id-ID")}</span> data (Filter aktif dari total {rawData.length.toLocaleString("id-ID")} prelist)
                        </div>
                        <div className="flex items-center gap-1">
                          
                          {/* Prev */}
                          <button
                            onClick={() => setDetailPage(prev => Math.max(prev - 1, 1))}
                            disabled={detailPage === 1}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 text-slate-500 dark:text-slate-400 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          {/* Page Numbers display */}
                          <div className="hidden sm:flex items-center gap-1 text-xs">
                            {detailPage > 3 && (
                              <>
                                <button onClick={() => setDetailPage(1)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">1</button>
                                {detailPage > 4 && <span className="text-slate-500 dark:text-slate-400 px-1">...</span>}
                              </>
                            )}

                            {Array.from({ length: 5 }, (_, i) => {
                              const pageNum = detailPage - 2 + i;
                              if (pageNum > 0 && pageNum <= totalDetailPageCount) {
                                  const active = pageNum === detailPage;
                                  return (
                                    <button
                                      key={pageNum}
                                      onClick={() => setDetailPage(pageNum)}
                                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                                        active
                                          ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/10"
                                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  );
                              }
                              return null;
                            })}

                            {detailPage < totalDetailPageCount - 2 && (
                              <>
                                {detailPage < totalDetailPageCount - 3 && <span className="text-slate-500 dark:text-slate-400 px-1">...</span>}
                                <button onClick={() => setDetailPage(totalDetailPageCount)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">{totalDetailPageCount}</button>
                              </>
                            )}
                          </div>

                          {/* Simple mobile page number */}
                          <div className="flex sm:hidden px-2 text-xs font-semibold">
                            Halaman {detailPage} dari {totalDetailPageCount}
                          </div>

                          {/* Next */}
                          <button
                            onClick={() => setDetailPage(prev => Math.min(prev + 1, totalDetailPageCount))}
                            disabled={detailPage === totalDetailPageCount}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 text-slate-500 dark:text-slate-400 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
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
