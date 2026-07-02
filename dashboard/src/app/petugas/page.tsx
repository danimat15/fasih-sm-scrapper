"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  ChevronRight,
  Filter,
  Send,
  XCircle,
  UserCheck,
  Percent,
  Layers,
  TrendingUp
} from "lucide-react";

// Interface for processed dashboard scraped data records
interface DashboardRecord {
  category: string;       // Pencacah or Pengawas
  email: string;          // Officer email
  slsCode: string;        // SLS Code
  open: number;           // OPEN count
  draft: number;          // DRAFT count
  submit: number;         // SUBMITTED BY Pencacah count
  reject: number;         // REJECTED BY Pengawas count
  approve: number;        // APPROVED BY Pengawas count
  revoked: number;        // REVOKED BY Pengawas count
  
  // 10 individual status values:
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

  namaPetugas: string;    // Name of officer
  jabatanPetugas: string; // PPL or PML
  namaKec: string;        // Kecamatan name
  koseka: string;         // Koseka name
  isPrioritas: string;    // Priority SLS flag
}

// Interface for aggregated officer stats
interface OfficerStats {
  namaPetugas: string;
  email: string;
  category: string;
  jabatanPetugas: string;
  namaKec: string;
  koseka: string;
  slsList: {
    slsCode: string;
    open: number;
    draft: number;
    submit: number;
    reject: number;
    approve: number;
    revoked: number;
    
    // 10 individual status values:
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

    total: number;
    progress: number;
    isPrioritas: boolean;
  }[];
  open: number;
  draft: number;
  submit: number;
  reject: number;
  approve: number;
  revoked: number;

  // 10 individual status values:
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

  total: number;
  progress: number; // sum of submit + reject + approve + revoked
  realisasi: number; // PCL: submit + reject + approve; PML: reject + approve
}

// Interface for aggregated kecamatan stats (grouped PML data)
interface KecamatanStats {
  namaKec: string;
  slsCount: number;
  open: number;
  draft: number;
  submit: number;
  reject: number;
  approve: number;
  revoked: number;

  // 10 individual status values:
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

  total: number;
  progress: number;
  realisasi: number;
  pmlList: {
    namaPetugas: string;
    email: string;
    slsCount: number;
    open: number;
    draft: number;
    submit: number;
    reject: number;
    approve: number;
    revoked: number;

    // 10 individual status values:
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

    total: number;
    progress: number;
    realisasi: number;
  }[];
}

const calculateTargetAndDiff = (realisasiPct: number) => {
  const startDate = new Date("2026-06-15");
  const today = new Date();
  
  // Reset time to midnight for accurate day calculations
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 15 to 15 is 1 day, 15 to 23 is 9 days
  
  // Daily target addition happens at 12:00 PM (noon)
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

export default function PetugasPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [rawData, setRawData] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Tabs and filters state
  const [activeTab, setActiveTab] = useState<"pcl" | "pml" | "kecamatan" | "prioritas">("pcl");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKec, setSelectedKec] = useState("all");
  const [sortBy, setSortBy] = useState<"nama" | "realisasi_desc" | "realisasi_asc" | "pct_desc" | "pct_asc">("nama");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const bannerTargetInfo = useMemo(() => calculateTargetAndDiff(0), [lastUpdated]);


  // Fetch and parse the CSV
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/dashboard_scraped_data.csv");
      if (!response.ok) {
        throw new Error("Gagal mengambil data dashboard_scraped_data.csv. Jalankan pipeline data telebih dahulu.");
      }

      const text = await response.text();
      const parsed = parseCSV(text);
      setRawData(parsed);

      // Fetch last updated timestamp
      try {
        const timeResponse = await fetch("/last_updated.txt");
        if (timeResponse.ok) {
          const loadedTimestamp = (await timeResponse.text()).trim();
          setLastUpdated(loadedTimestamp);
        }
      } catch (e) {
        console.warn("Gagal memuat file last_updated.txt, fallback ke waktu sekarang.");
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

  // Simple Quote-Aware CSV Parser with Dynamic Header Mapping
  const parseCSV = (csvText: string): DashboardRecord[] => {
    const lines = csvText.split("\n");
    if (lines.length === 0) return [];
    
    // Parse header to find column indices
    const headerLine = lines[0].trim();
    const headers: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let j = 0; j < headerLine.length; j++) {
      const char = headerLine[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        headers.push(entry.replace(/"/g, "").trim().toLowerCase());
        entry = "";
      } else {
        entry += char;
      }
    }
    headers.push(entry.replace(/"/g, "").trim().toLowerCase());

    const idxCategory = headers.indexOf("category");
    const idxEmail = headers.indexOf("email");
    const idxSlsCode = headers.indexOf("sls code");
    
    const idxOpen = headers.indexOf("open");
    const idxDraft = headers.indexOf("draft");
    
    const idxSubmit = headers.indexOf("submitted by pencacah");
    const idxSubmitResp = headers.indexOf("submitted respondent");
    
    const idxReject = headers.indexOf("rejected by pengawas");
    const idxRejectAdmin = headers.indexOf("rejected by admin kabupaten");
    
    const idxApprove = headers.indexOf("approved by pengawas");
    const idxCompletedAdmin = headers.indexOf("completed by admin kabupaten");
    const idxEditedAdmin = headers.indexOf("edited by admin kabupaten");
    
    const idxRevoked = headers.indexOf("revoked by pengawas");
    
    const idxNamaPetugas = headers.indexOf("nama_petugas");
    const idxJabatanPetugas = headers.indexOf("jabatan_petugas");
    const idxNamaKec = headers.indexOf("nama_kec");
    const idxKoseka = headers.indexOf("koseka");
    const idxIsPrioritas = headers.indexOf("is_prioritas");

    const parsed: DashboardRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row: string[] = [];
      insideQuote = false;
      entry = "";

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

      if (row.length >= 8) {
        const valOpen = idxOpen !== -1 ? parseInt(row[idxOpen]) || 0 : 0;
        const valDraft = idxDraft !== -1 ? parseInt(row[idxDraft]) || 0 : 0;
        
        const valSubmitPencacah = idxSubmit !== -1 ? parseInt(row[idxSubmit]) || 0 : 0;
        const valSubmitResp = idxSubmitResp !== -1 ? parseInt(row[idxSubmitResp]) || 0 : 0;
        
        const valRejectPengawas = idxReject !== -1 ? parseInt(row[idxReject]) || 0 : 0;
        const valRejectAdmin = idxRejectAdmin !== -1 ? parseInt(row[idxRejectAdmin]) || 0 : 0;
        
        const valApprovePengawas = idxApprove !== -1 ? parseInt(row[idxApprove]) || 0 : 0;
        const valCompletedAdmin = idxCompletedAdmin !== -1 ? parseInt(row[idxCompletedAdmin]) || 0 : 0;
        const valEditedAdmin = idxEditedAdmin !== -1 ? parseInt(row[idxEditedAdmin]) || 0 : 0;
        
        const valRevoked = idxRevoked !== -1 ? parseInt(row[idxRevoked]) || 0 : 0;

        parsed.push({
          category: idxCategory !== -1 && row[idxCategory] ? row[idxCategory].replace(/"/g, "").trim() : "",
          email: idxEmail !== -1 && row[idxEmail] ? row[idxEmail].replace(/"/g, "").trim() : "",
          slsCode: idxSlsCode !== -1 && row[idxSlsCode] ? row[idxSlsCode].replace(/"/g, "").trim() : "",
          open: valOpen,
          draft: valDraft,
          submit: valSubmitPencacah + valSubmitResp,
          reject: valRejectPengawas + valRejectAdmin,
          approve: valApprovePengawas + valCompletedAdmin + valEditedAdmin,
          revoked: valRevoked,
          
          open_count: valOpen,
          draft_count: valDraft,
          submitted_pencacah: valSubmitPencacah,
          submitted_respondent: valSubmitResp,
          rejected_pengawas: valRejectPengawas,
          rejected_admin: valRejectAdmin,
          approved_pengawas: valApprovePengawas,
          completed_admin: valCompletedAdmin,
          edited_admin: valEditedAdmin,
          revoked_pengawas: valRevoked,

          namaPetugas: idxNamaPetugas !== -1 && row[idxNamaPetugas] ? row[idxNamaPetugas].replace(/"/g, "").trim() : "",
          jabatanPetugas: idxJabatanPetugas !== -1 && row[idxJabatanPetugas] ? row[idxJabatanPetugas].replace(/"/g, "").trim() : "",
          namaKec: idxNamaKec !== -1 && row[idxNamaKec] ? row[idxNamaKec].replace(/"/g, "").trim() : "",
          koseka: idxKoseka !== -1 && row[idxKoseka] ? row[idxKoseka].replace(/"/g, "").trim() : "",
          isPrioritas: idxIsPrioritas !== -1 && row[idxIsPrioritas] ? row[idxIsPrioritas].replace(/"/g, "").trim() : "Tidak",
        });
      }
    }
    return parsed;
  };

  // Helper to format subdistrict names to Title Case and strip BPS codes
  const formatKecName = (name: string): string => {
    if (!name) return "-";
    let cleaned = name.replace(/\(\d+\)/g, "").trim();
    return cleaned
      .toLowerCase()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Aggregate stats by officer
  const aggregatedStats = useMemo(() => {
    const map: { 
      [email: string]: OfficerStats & { 
        kecSet?: Set<string>; 
        kosekaSet?: Set<string>; 
      } 
    } = {};

    rawData.forEach(record => {
      const email = record.email.toLowerCase().trim();
      if (!email) return;

      const cleanedKec = record.namaKec ? formatKecName(record.namaKec) : "";
      const cleanedKoseka = record.koseka && record.koseka !== "-" ? record.koseka.trim() : "";

      if (!map[email]) {
        map[email] = {
          namaPetugas: record.namaPetugas || email.split("@")[0],
          email: record.email,
          category: record.category,
          jabatanPetugas: record.jabatanPetugas || (record.category === "Pengawas" ? "PML" : "PPL"),
          namaKec: "",
          koseka: "",
          slsList: [],
          open: 0,
          draft: 0,
          submit: 0,
          reject: 0,
          approve: 0,
          revoked: 0,
          
          open_count: 0,
          draft_count: 0,
          submitted_pencacah: 0,
          submitted_respondent: 0,
          rejected_pengawas: 0,
          rejected_admin: 0,
          approved_pengawas: 0,
          completed_admin: 0,
          edited_admin: 0,
          revoked_pengawas: 0,

          total: 0,
          progress: 0,
          realisasi: 0,
          kecSet: new Set<string>(),
          kosekaSet: new Set<string>()
        };
      }

      if (cleanedKec && cleanedKec !== "-") {
        map[email].kecSet?.add(cleanedKec);
      }
      if (cleanedKoseka && cleanedKoseka !== "-") {
        map[email].kosekaSet?.add(cleanedKoseka);
      }

      // Add SLS info
      const slsTotal = record.open + record.draft + record.submit + record.reject + record.approve + record.revoked;
      const slsProgress = record.submit + record.reject + record.approve + record.revoked;

      map[email].slsList.push({
        slsCode: record.slsCode,
        open: record.open,
        draft: record.draft,
        submit: record.submit,
        reject: record.reject,
        approve: record.approve,
        revoked: record.revoked,
        
        open_count: record.open_count,
        draft_count: record.draft_count,
        submitted_pencacah: record.submitted_pencacah,
        submitted_respondent: record.submitted_respondent,
        rejected_pengawas: record.rejected_pengawas,
        rejected_admin: record.rejected_admin,
        approved_pengawas: record.approved_pengawas,
        completed_admin: record.completed_admin,
        edited_admin: record.edited_admin,
        revoked_pengawas: record.revoked_pengawas,

        total: slsTotal,
        progress: slsProgress,
        isPrioritas: record.isPrioritas === "Ya"
      });

      // Sum metrics
      map[email].open += record.open;
      map[email].draft += record.draft;
      map[email].submit += record.submit;
      map[email].reject += record.reject;
      map[email].approve += record.approve;
      map[email].revoked += record.revoked;
      
      map[email].open_count += record.open_count;
      map[email].draft_count += record.draft_count;
      map[email].submitted_pencacah += record.submitted_pencacah;
      map[email].submitted_respondent += record.submitted_respondent;
      map[email].rejected_pengawas += record.rejected_pengawas;
      map[email].rejected_admin += record.rejected_admin;
      map[email].approved_pengawas += record.approved_pengawas;
      map[email].completed_admin += record.completed_admin;
      map[email].edited_admin += record.edited_admin;
      map[email].revoked_pengawas += record.revoked_pengawas;

      map[email].total += slsTotal;
      map[email].progress += slsProgress;

      // Realisasi berbeda per kategori:
      // PCL (Pencacah): submit + reject + approve + revoked
      // PML (Pengawas): reject + approve + revoked
      const isPCL = record.category.toLowerCase() === "pencacah";
      const slsRealisasi = isPCL
        ? (record.submit + record.reject + record.approve + record.revoked)
        : (record.reject + record.approve + record.revoked);
      map[email].realisasi += slsRealisasi;
    });

    return Object.values(map).map(officer => {
      const kecs = Array.from(officer.kecSet || []).sort();
      officer.namaKec = kecs.length > 0 ? kecs.join(" & ") : "-";

      const kosekas = Array.from(officer.kosekaSet || []).sort();
      officer.koseka = kosekas.length > 0 ? kosekas.join(" & ") : "-";

      delete officer.kecSet;
      delete officer.kosekaSet;

      return officer;
    });
  }, [rawData]);

  const kecamatanStats = useMemo(() => {
    const map: {
      [kecName: string]: {
        namaKec: string;
        slsCount: number;
        open: number;
        draft: number;
        submit: number;
        reject: number;
        approve: number;
        revoked: number;

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

        total: number;
        progress: number;
        realisasi: number;
        pmlMap: {
          [email: string]: {
            namaPetugas: string;
            email: string;
            slsCount: number;
            open: number;
            draft: number;
            submit: number;
            reject: number;
            approve: number;
            revoked: number;

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

            total: number;
            progress: number;
            realisasi: number;
          };
        };
      };
    } = {};

    rawData.forEach(record => {
      if (record.category.toLowerCase() !== "pengawas") return;
      const kec = record.namaKec || "-";
      const email = record.email.toLowerCase().trim();
      if (!email) return;

      if (!map[kec]) {
        map[kec] = {
          namaKec: kec,
          slsCount: 0,
          open: 0,
          draft: 0,
          submit: 0,
          reject: 0,
          approve: 0,
          revoked: 0,

          open_count: 0,
          draft_count: 0,
          submitted_pencacah: 0,
          submitted_respondent: 0,
          rejected_pengawas: 0,
          rejected_admin: 0,
          approved_pengawas: 0,
          completed_admin: 0,
          edited_admin: 0,
          revoked_pengawas: 0,

          total: 0,
          progress: 0,
          realisasi: 0,
          pmlMap: {}
        };
      }

      const k = map[kec];
      const slsTotal = record.open + record.draft + record.submit + record.reject + record.approve + record.revoked;
      const slsProgress = record.submit + record.reject + record.approve + record.revoked;
      const slsRealisasiPml = record.submit + record.reject + record.approve + record.revoked; // Kecamatan uses: submit + reject + approve + revoked

      k.open += record.open;
      k.draft += record.draft;
      k.submit += record.submit;
      k.reject += record.reject;
      k.approve += record.approve;
      k.revoked += record.revoked;

      k.open_count += record.open_count;
      k.draft_count += record.draft_count;
      k.submitted_pencacah += record.submitted_pencacah;
      k.submitted_respondent += record.submitted_respondent;
      k.rejected_pengawas += record.rejected_pengawas;
      k.rejected_admin += record.rejected_admin;
      k.approved_pengawas += record.approved_pengawas;
      k.completed_admin += record.completed_admin;
      k.edited_admin += record.edited_admin;
      k.revoked_pengawas += record.revoked_pengawas;

      k.total += slsTotal;
      k.progress += slsProgress;
      k.realisasi += slsRealisasiPml;
      k.slsCount += 1;

      if (!k.pmlMap[email]) {
        k.pmlMap[email] = {
          namaPetugas: record.namaPetugas || email.split("@")[0],
          email: record.email,
          slsCount: 0,
          open: 0,
          draft: 0,
          submit: 0,
          reject: 0,
          approve: 0,
          revoked: 0,

          open_count: 0,
          draft_count: 0,
          submitted_pencacah: 0,
          submitted_respondent: 0,
          rejected_pengawas: 0,
          rejected_admin: 0,
          approved_pengawas: 0,
          completed_admin: 0,
          edited_admin: 0,
          revoked_pengawas: 0,

          total: 0,
          progress: 0,
          realisasi: 0
        };
      }
      const p = k.pmlMap[email];
      p.open += record.open;
      p.draft += record.draft;
      p.submit += record.submit;
      p.reject += record.reject;
      p.approve += record.approve;
      p.revoked += record.revoked;

      p.open_count += record.open_count;
      p.draft_count += record.draft_count;
      p.submitted_pencacah += record.submitted_pencacah;
      p.submitted_respondent += record.submitted_respondent;
      p.rejected_pengawas += record.rejected_pengawas;
      p.rejected_admin += record.rejected_admin;
      p.approved_pengawas += record.approved_pengawas;
      p.completed_admin += record.completed_admin;
      p.edited_admin += record.edited_admin;
      p.revoked_pengawas += record.revoked_pengawas;

      p.total += slsTotal;
      p.slsCount += 1;
      p.progress += slsProgress;
      p.realisasi += slsRealisasiPml; // Kecamatan uses: submit + reject + approve + revoked
    });

    return Object.values(map).map(k => {
      const { pmlMap, ...rest } = k;
      return {
        ...rest,
        pmlList: Object.values(pmlMap)
      };
    });
  }, [rawData]);

  // Unique Kecamatan List for filters
  const subdistrictOptions = useMemo(() => {
    const list = rawData.map(r => r.namaKec).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rawData]);

  // Aggregate stats for SLS Prioritas
  const prioritySLSStats = useMemo(() => {
    const map: { [slsCode: string]: {
      slsCode: string;
      namaKec: string;
      koseka: string;
      pencacah: string;
      pengawas: string;
      open: number;
      draft: number;
      submit: number;
      reject: number;
      approve: number;
      revoked: number;

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

      total: number;
      progress: number;
      realisasi: number;
      hasPengawasRecord: boolean;
    } } = {};

    rawData.forEach(record => {
      if (record.isPrioritas !== "Ya") return;
      const code = record.slsCode;
      
      if (!map[code]) {
        map[code] = {
          slsCode: code,
          namaKec: record.namaKec || "-",
          koseka: record.koseka || "-",
          pencacah: "-",
          pengawas: "-",
          open: 0,
          draft: 0,
          submit: 0,
          reject: 0,
          approve: 0,
          revoked: 0,

          open_count: 0,
          draft_count: 0,
          submitted_pencacah: 0,
          submitted_respondent: 0,
          rejected_pengawas: 0,
          rejected_admin: 0,
          approved_pengawas: 0,
          completed_admin: 0,
          edited_admin: 0,
          revoked_pengawas: 0,

          total: 0,
          progress: 0,
          realisasi: 0,
          hasPengawasRecord: false,
        };
      }

      const entry = map[code];

      // Collect officer names based on category
      const isPencacah = record.category.toLowerCase() === "pencacah";
      const isPengawas = record.category.toLowerCase() === "pengawas";

      if (isPencacah) {
        entry.pencacah = record.namaPetugas || "-";
      } else if (isPengawas) {
        entry.pengawas = record.namaPetugas || "-";
      }

      // If we don't have a Pengawas record yet, or this record IS the Pengawas record,
      // update the status counts.
      if (isPengawas || (!entry.hasPengawasRecord)) {
        entry.open = record.open;
        entry.draft = record.draft;
        entry.submit = record.submit;
        entry.reject = record.reject;
        entry.approve = record.approve;
        entry.revoked = record.revoked;

        entry.open_count = record.open_count;
        entry.draft_count = record.draft_count;
        entry.submitted_pencacah = record.submitted_pencacah;
        entry.submitted_respondent = record.submitted_respondent;
        entry.rejected_pengawas = record.rejected_pengawas;
        entry.rejected_admin = record.rejected_admin;
        entry.approved_pengawas = record.approved_pengawas;
        entry.completed_admin = record.completed_admin;
        entry.edited_admin = record.edited_admin;
        entry.revoked_pengawas = record.revoked_pengawas;
        
        const slsTotal = record.open + record.draft + record.submit + record.reject + record.approve + record.revoked;
        const slsProgress = record.submit + record.reject + record.approve + record.revoked;
        
        entry.total = slsTotal;
        entry.progress = slsProgress;
        // Prioritas uses Pengawas data as source: realisasi = submit + reject + approve + revoked
        entry.realisasi = record.submit + record.reject + record.approve + record.revoked;

        if (isPengawas) {
          entry.hasPengawasRecord = true;
        }
      }

      // Ensure we fill in Kecamatan and Koseka if not already populated
      if (record.namaKec && entry.namaKec === "-") {
        entry.namaKec = record.namaKec;
      }
      if (record.koseka && entry.koseka === "-") {
        entry.koseka = record.koseka;
      }
    });

    return Object.values(map);
  }, [rawData]);

  // Filtered priority SLS list
  const filteredPrioritySLS = useMemo(() => {
    if (activeTab !== "prioritas") return [];

    const base = prioritySLSStats.filter(item => {
      // Subdistrict filter
      if (selectedKec !== "all" && item.namaKec !== selectedKec) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.slsCode.toLowerCase().includes(query) ||
          item.namaKec.toLowerCase().includes(query) ||
          item.koseka.toLowerCase().includes(query) ||
          item.pencacah.toLowerCase().includes(query) ||
          item.pengawas.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sorting
    if (sortBy === "nama") {
      return base.sort((a, b) => a.slsCode.localeCompare(b.slsCode));
    } else if (sortBy === "realisasi_desc") {
      return base.sort((a, b) => b.realisasi - a.realisasi);
    } else if (sortBy === "realisasi_asc") {
      return base.sort((a, b) => a.realisasi - b.realisasi);
    } else if (sortBy === "pct_desc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctB - pctA;
      });
    } else if (sortBy === "pct_asc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctA - pctB;
      });
    }

    return base;
  }, [prioritySLSStats, activeTab, selectedKec, searchQuery, sortBy]);

  // Filtered officers list
  const filteredOfficers = useMemo(() => {
    const base = aggregatedStats.filter(off => {
      // Category filter (Tab: PCL or PML)
      const targetCategory = activeTab === "pcl" ? "Pencacah" : "Pengawas";
      if (off.category.toLowerCase() !== targetCategory.toLowerCase()) {
        return false;
      }

      // Subdistrict filter
      if (selectedKec !== "all") {
        const targetKec = formatKecName(selectedKec).toLowerCase();
        if (!off.namaKec.toLowerCase().includes(targetKec)) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          off.namaPetugas.toLowerCase().includes(query) ||
          off.email.toLowerCase().includes(query) ||
          off.namaKec.toLowerCase().includes(query) ||
          off.koseka.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sorting
    if (sortBy === "nama") {
      return base.sort((a, b) => a.namaPetugas.localeCompare(b.namaPetugas));
    } else if (sortBy === "realisasi_desc") {
      return base.sort((a, b) => b.realisasi - a.realisasi);
    } else if (sortBy === "realisasi_asc") {
      return base.sort((a, b) => a.realisasi - b.realisasi);
    } else if (sortBy === "pct_desc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctB - pctA;
      });
    } else if (sortBy === "pct_asc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctA - pctB;
      });
    }

    return base;
  }, [aggregatedStats, activeTab, selectedKec, searchQuery, sortBy]);

  // Filtered kecamatans list
  const filteredKecamatans = useMemo(() => {
    if (activeTab !== "kecamatan") return [];

    const base = kecamatanStats.filter(kec => {
      // Subdistrict filter
      if (selectedKec !== "all" && kec.namaKec !== selectedKec) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          kec.namaKec.toLowerCase().includes(query) ||
          kec.pmlList.some(p =>
            p.namaPetugas.toLowerCase().includes(query) ||
            p.email.toLowerCase().includes(query)
          )
        );
      }

      return true;
    });

    // Sorting
    if (sortBy === "nama") {
      return base.sort((a, b) => a.namaKec.localeCompare(b.namaKec));
    } else if (sortBy === "realisasi_desc") {
      return base.sort((a, b) => b.realisasi - a.realisasi);
    } else if (sortBy === "realisasi_asc") {
      return base.sort((a, b) => a.realisasi - b.realisasi);
    } else if (sortBy === "pct_desc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctB - pctA;
      });
    } else if (sortBy === "pct_asc") {
      return base.sort((a, b) => {
        const pctA = a.total > 0 ? (a.realisasi / a.total) : 0;
        const pctB = b.total > 0 ? (b.realisasi / b.total) : 0;
        return pctA - pctB;
      });
    }

    return base;
  }, [kecamatanStats, activeTab, selectedKec, searchQuery, sortBy]);

  // Expand / collapse row handler
  const toggleRow = (email: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedRows(newExpanded);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === "kecamatan") {
      const headers = [
        "Nama Kecamatan", "Jumlah PML", "Jumlah SLS", 
        "Total Target", "OPEN", "DRAFT", "SUBMITTED BY Pencacah", 
        "REJECTED BY Pengawas", "APPROVED BY Pengawas", "REVOKED BY Pengawas", "Progres / Realisasi", "Realisasi (%)"
      ];
      const csvRows = [headers.join(",")];

      filteredKecamatans.forEach(k => {
        const pct = k.total > 0 ? ((k.realisasi / k.total) * 100).toFixed(2) : "0.00";
        const row = [
          `"${formatKecName(k.namaKec).replace(/"/g, '""')}"`,
          k.pmlList.length,
          k.slsCount,
          k.total,
          k.open,
          k.draft,
          k.submit,
          k.reject,
          k.approve,
          k.revoked,
          k.realisasi,
          `"${pct}%"`
        ];
        csvRows.push(row.join(","));
      });

      const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `monitoring_kecamatan_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (activeTab === "prioritas") {
      const headers = [
        "Kode SLS", "Kecamatan", "Koseka", "Pencacah (PCL)", "Pengawas (PML)", 
        "Total Target", "OPEN", "DRAFT", "SUBMITTED BY Pencacah", 
        "REJECTED BY Pengawas", "APPROVED BY Pengawas", "REVOKED BY Pengawas", "Progres", "Realisasi", "Realisasi (%)"
      ];
      const csvRows = [headers.join(",")];

      filteredPrioritySLS.forEach(item => {
        const pct = item.total > 0 ? ((item.realisasi / item.total) * 100).toFixed(2) : "0.00";
        const row = [
          `"${item.slsCode}"`,
          `"${formatKecName(item.namaKec).replace(/"/g, '""')}"`,
          `"${item.koseka.replace(/"/g, '""')}"`,
          `"${item.pencacah.replace(/"/g, '""')}"`,
          `"${item.pengawas.replace(/"/g, '""')}"`,
          item.total,
          item.open,
          item.draft,
          item.submit,
          item.reject,
          item.approve,
          item.revoked,
          item.progress,
          item.realisasi,
          `"${pct}%"`
        ];
        csvRows.push(row.join(","));
      });

      const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `monitoring_prioritas_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = [
      "Nama Petugas", "Email", "Jabatan", "Kecamatan", "Koseka", 
      "Total Target", "OPEN", "DRAFT", "SUBMITTED BY Pencacah", 
      "REJECTED BY Pengawas", "APPROVED BY Pengawas", "REVOKED BY Pengawas", "Progres / Realisasi", "Realisasi (%)"
    ];
    const csvRows = [headers.join(",")];

    filteredOfficers.forEach(o => {
      const pct = o.total > 0 ? ((o.realisasi / o.total) * 100).toFixed(2) : "0.00";
      const row = [
        `"${o.namaPetugas.replace(/"/g, '""')}"`,
        `"${o.email.replace(/"/g, '""')}"`,
        `"${o.jabatanPetugas}"`,
        `"${formatKecName(o.namaKec).replace(/"/g, '""')}"`,
        `"${o.koseka.replace(/"/g, '""')}"`,
        o.total,
        o.open,
        o.draft,
        o.submit,
        o.reject,
        o.approve,
        o.revoked,
        o.realisasi,
        `"${pct}%"`
      ];
      csvRows.push(row.join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `monitoring_petugas_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Highlight rules functions
  const isPmlRed = (o: OfficerStats) => {
    // PML merah jika approve dan rejectnya masih 0
    return o.category.toLowerCase() === "pengawas" && o.approve === 0 && o.reject === 0;
  };

  const isPclRed = (o: OfficerStats) => {
    // PCL merah jika Draft, Submit, Reject, Approve, dan Revoked = 0
    return (
      o.category.toLowerCase() === "pencacah" &&
      o.draft === 0 &&
      o.submit === 0 &&
      o.reject === 0 &&
      o.approve === 0 &&
      o.revoked === 0
    );
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-0 md:h-16 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Visual BPS Logo Icon */}
            <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl p-1 shadow-md border border-slate-200 dark:border-slate-700 shrink-0">
              <img src="/icon.png" alt="Logo BPS" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                BPS Kabupaten Kepulauan Sangihe
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Dashboard Monitoring Sensus Ekonomi 2026
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <nav className="flex items-center gap-0.5 sm:gap-1 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 sm:p-1 bg-slate-50/50 dark:bg-slate-950/50 flex-1 md:flex-none justify-center overflow-x-auto scrollbar-none flex-nowrap min-w-0">
              <Link 
                href="/" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
              >
                Dashboard
              </Link>
              <Link 
                href="/tabulasi" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
              >
                Tabulasi
              </Link>
              <Link 
                href="/petugas" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all bg-orange-500 text-white shadow-sm shrink-0"
              >
                Petugas
              </Link>
              <Link 
                href="/usaha" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
              >
                Usaha
              </Link>
              <Link 
                href="/comparison-sbr" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
              >
                Comparison SBR
              </Link>
              <Link 
                href="/anomali" 
                className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
              >
                Anomali
              </Link>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Ganti Tema"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-500" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Title */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-5 sm:p-10 text-white shadow-xl shadow-orange-600/10 mb-8">
          <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-20 -translate-y-20"></div>
          <div className="absolute right-1/4 bottom-0 w-60 h-60 rounded-full bg-orange-400/20 blur-2xl translate-y-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/20 text-white mb-2 inline-block">
                Monitoring Kinerja Petugas
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                Monitoring Progres Petugas (Rekap)
              </h2>
              <p className="text-xs sm:text-base md:text-lg text-orange-50 max-w-2xl font-light">
                Analisis detail capaian kinerja dari Pencacah (PCL/PPL) dan Pengawas (PML) secara real-time.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 self-start md:self-auto flex flex-col items-start md:items-end border border-white/10 text-left md:text-right">
              <span className="text-[10px] sm:text-xs text-orange-200">Terakhir Diperbarui</span>
              <span className="text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0"></span>
                <span className="truncate">{loading ? "Menyinkronkan..." : lastUpdated || "Belum ada data"}</span>
              </span>
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
            <p className="text-slate-700 dark:text-slate-300 font-semibold animate-pulse text-sm">
              Mengekstrak dan Memproses Data Petugas BPS FASIH...
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
            {/* View Selection & Search Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-8 shadow-sm flex flex-col gap-4">
              
              {/* Tab Selector & Actions */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                
                {/* Tabs */}
                <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl overflow-x-auto whitespace-nowrap scrollbar-none w-full lg:w-auto">
                  <button
                    onClick={() => {
                      setActiveTab("pcl");
                      setExpandedRows(new Set());
                    }}
                    className={`shrink-0 flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "pcl"
                        ? "bg-white dark:bg-slate-900 text-orange-500 shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Pencacah (PCL)
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("pml");
                      setExpandedRows(new Set());
                    }}
                    className={`shrink-0 flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "pml"
                        ? "bg-white dark:bg-slate-900 text-orange-500 shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Pengawas (PML)
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("kecamatan");
                      setExpandedRows(new Set());
                    }}
                    className={`shrink-0 flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "kecamatan"
                        ? "bg-white dark:bg-slate-900 text-orange-500 shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    Kecamatan
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("prioritas");
                      setExpandedRows(new Set());
                    }}
                    className={`shrink-0 flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "prioritas"
                        ? "bg-white dark:bg-slate-900 text-orange-500 shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    SLS Prioritas
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 scrollbar-none">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="shrink-0 flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm bg-white dark:bg-slate-950 cursor-pointer"
                  >
                    <Filter className="w-4 h-4 text-orange-500" />
                    <span>{showFilters ? "Tutup Filter" : "Filter Lanjutan"}</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="shrink-0 flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Ekspor CSV
                  </button>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Search Bar */}
                <div className="col-span-12 md:col-span-6 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari nama petugas, email, kecamatan, atau nama Koseka..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-100 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/80 outline-none transition-all border-slate-300 dark:border-slate-800 text-slate-950 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 font-semibold"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Kecamatan Selector */}
                <div className={`${showFilters ? "col-span-12 md:col-span-3 block" : "hidden md:block md:col-span-3"} relative`}>
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Filter className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedKec}
                    onChange={(e) => setSelectedKec(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-100 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/80 outline-none transition-all border-slate-300 dark:border-slate-800 appearance-none text-slate-950 dark:text-slate-50 cursor-pointer font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Kecamatan</option>
                    {subdistrictOptions.map(kec => (
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={kec} value={kec}>
                        {formatKecName(kec)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* Sort Selector */}
                <div className={`${showFilters ? "col-span-12 md:col-span-3 block" : "hidden md:block md:col-span-3"} relative`}>
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-100 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/80 outline-none transition-all border-slate-300 dark:border-slate-800 appearance-none text-slate-950 dark:text-slate-50 cursor-pointer font-bold"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="nama">
                      {activeTab === "prioritas"
                        ? "Kode SLS (A-Z)"
                        : activeTab === "kecamatan"
                        ? "Nama Kecamatan (A-Z)"
                        : "Nama Petugas (A-Z)"}
                    </option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="realisasi_desc">Realisasi Terbesar (Jumlah)</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="realisasi_asc">Realisasi Terkecil (Jumlah)</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pct_desc">Persentase Terbesar (%)</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pct_asc">Persentase Terkecil (%)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
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
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Hijau</span>: Di atas target harian akumulatif (<span className="font-bold font-mono">&gt;= {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                      </li>
                      <li>
                        <span className="text-red-500 dark:text-red-400 font-extrabold">Merah</span>: Di bawah 50% target harian akumulatif (<span className="font-bold font-mono">&lt; {(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}%</span>).
                      </li>
                      <li>
                        <span className="text-amber-650 dark:text-amber-500 font-extrabold">Kuning</span>: Di antara 50% target s.d target harian akumulatif (<span className="font-bold font-mono">{(bannerTargetInfo.cumulativeTarget * 0.5).toFixed(2)}% s.d {bannerTargetInfo.cumulativeTarget.toFixed(2)}%</span>).
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-bold">Progres</span> dihitung dari jumlah status yang bukan OPEN dan DRAFT.
                  </li>
                  <li>
                    <span className="font-bold">Realisasi PCL, Kecamatan & SLS Prioritas</span> = APPROVED BY Pengawas + SUBMITTED BY Pencacah + REJECTED BY Pengawas + REJECTED BY Admin Kabupaten + REVOKED BY Pengawas + SUBMITTED RESPONDENT + COMPLETED BY Admin Kabupaten + EDITED BY Admin Kabupaten.
                  </li>
                  <li>
                    <span className="font-bold">Realisasi PML</span> = APPROVED BY Pengawas + REJECTED BY Pengawas + REVOKED BY Pengawas + REJECTED BY Admin Kabupaten + COMPLETED BY Admin Kabupaten + EDITED BY Admin Kabupaten.
                  </li>
                </ul>
              </div>
            </div>

            {/* Officers Data Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-auto max-h-[1100px] w-full">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                    <tr className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                      {activeTab !== "prioritas" && (
                        <th className="py-4 px-4 w-10 bg-slate-50 dark:bg-slate-900"></th>
                      )}
                      <th className="py-4 px-2 w-12 text-center bg-slate-50 dark:bg-slate-900">No</th>
                      <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">
                        {activeTab === "prioritas"
                          ? "Kode SLS"
                          : activeTab === "kecamatan"
                          ? "Nama Kecamatan"
                          : "Nama Petugas"}
                      </th>
                      {activeTab === "prioritas" && (
                        <>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Kecamatan</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Koseka</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Pencacah (PCL)</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Pengawas (PML)</th>
                        </>
                      )}
                      {activeTab !== "kecamatan" && activeTab !== "prioritas" && (
                        <>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Kecamatan</th>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Koseka</th>
                          <th className="py-4 px-4 text-center bg-slate-50 dark:bg-slate-900">SLS</th>
                        </>
                      )}
                      {activeTab === "kecamatan" && (
                        <>
                          <th className="py-4 px-4 bg-slate-50 dark:bg-slate-900">Jumlah PML</th>
                          <th className="py-4 px-4 text-center bg-slate-50 dark:bg-slate-900">SLS</th>
                        </>
                      )}
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Target</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-amber-600 dark:text-amber-500">Open</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-blue-600 dark:text-blue-500">Draft</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-teal-650 dark:text-teal-400">Sub PPL</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-teal-600/80 dark:text-teal-400/80">Sub Resp</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-red-650 dark:text-red-550">Rej PML</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-red-600/80 dark:text-red-400/80">Rej Kab</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-emerald-650 dark:text-emerald-500">App PML</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-emerald-650/80 dark:text-emerald-450/85">Comp Kab</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-emerald-600/80 dark:text-emerald-400/80">Edit Kab</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap text-rose-600 dark:text-rose-500/90">Revoked</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Progres</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 whitespace-nowrap">Realisasi</th>
                      <th className="py-4 px-3 text-center bg-slate-50 dark:bg-slate-900 sticky right-0 top-0 z-30 border-l border-slate-200 dark:border-slate-800 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(30,41,59,1)]">% Realisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === "kecamatan" ? (                       filteredKecamatans.length === 0 ? (
                        <tr>
                          <td colSpan={19} className="py-10 text-center text-slate-700 dark:text-slate-300 text-xs">
                            Tidak ada data kecamatan yang cocok dengan filter atau pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        filteredKecamatans.map((k, index) => {
                          const isRed = k.approve === 0 && k.reject === 0;
                          const isExpanded = expandedRows.has(k.namaKec);
                          const pctRealisasi = k.total > 0 ? ((k.realisasi / k.total) * 100).toFixed(2) : "0.00";

                          const targetInfo = calculateTargetAndDiff(parseFloat(pctRealisasi));
                          let rowColor = "bg-amber-500/5 dark:bg-amber-950/10";
                          if (targetInfo.isAboveTarget) {
                            rowColor = "bg-emerald-500/5 dark:bg-emerald-950/10";
                          } else if (targetInfo.isBelowHalfTarget) {
                            rowColor = "bg-rose-500/5 dark:bg-rose-950/10";
                          }

                          return (
                            <React.Fragment key={k.namaKec}>
                              {/* Kecamatan Summary Row */}
                              <tr
                                className={`group border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors cursor-pointer text-xs ${rowColor}`}
                                onClick={() => toggleRow(k.namaKec)}
                              >
                                <td className="py-3 px-4 text-center">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-4 font-semibold">
                                  {formatKecName(k.namaKec)}
                                </td>
                                <td className="py-3 px-4 font-normal">{k.pmlList.length} PML</td>
                                <td className="py-3 px-4 text-center font-normal">{k.slsCount}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{k.total}</td>
                                <td className="py-3 px-3 text-center font-normal text-amber-600 dark:text-amber-500/90">{k.open_count}</td>
                                <td className="py-3 px-3 text-center font-normal text-blue-600 dark:text-blue-500/90">{k.draft_count}</td>
                                <td className="py-3 px-3 text-center font-normal text-teal-600 dark:text-teal-500/90">{k.submitted_pencacah}</td>
                                <td className="py-3 px-3 text-center font-normal text-teal-500/80 dark:text-teal-400/80">{k.submitted_respondent}</td>
                                <td className="py-3 px-3 text-center font-normal text-red-650 dark:text-red-500/90">{k.rejected_pengawas}</td>
                                <td className="py-3 px-3 text-center font-normal text-red-600/80 dark:text-red-400/80">{k.rejected_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-600 dark:text-emerald-500/90">{k.approved_pengawas}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-500/80 dark:text-emerald-450/85">{k.completed_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-600/70 dark:text-emerald-400/70">{k.edited_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-rose-600 dark:text-rose-500/90">{k.revoked_pengawas}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{k.progress}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{k.realisasi}</td>
                                <td className="py-3 px-4 text-center sticky right-0 z-10 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-950 transition-colors">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full font-extrabold text-xs ${
                                      targetInfo.isAboveTarget
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
                                        : targetInfo.isBelowHalfTarget
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
                                    }`}>
                                      {pctRealisasi}%
                                    </span>
                                    <span className={`text-[9px] font-bold ${
                                      targetInfo.isAboveTarget
                                        ? "text-emerald-600 dark:text-emerald-450"
                                        : targetInfo.isBelowHalfTarget
                                        ? "text-rose-500 dark:text-rose-405"
                                        : "text-amber-600 dark:text-amber-500"
                                    }`}>
                                      {targetInfo.diff >= 0 
                                        ? `+${targetInfo.diff.toFixed(2)}% (Lebih)` 
                                        : `${targetInfo.diff.toFixed(2)}% (Kurang)`}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded PML List in Kecamatan Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/20 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                                  <td colSpan={19} className="py-4 px-8">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4 shadow-inner">
                                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-orange-500" />
                                        Daftar PML di Kecamatan {formatKecName(k.namaKec)}
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[9px]">
                                              <th className="pb-2 font-bold whitespace-nowrap">Nama PML</th>
                                              <th className="pb-2 font-bold whitespace-nowrap">Email</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">SLS</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Target</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Open</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Draft</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Sub PPL</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Sub Resp</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Rej PML</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Rej Kab</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">App PML</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Comp Kab</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Edit Kab</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Revoked</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Progres</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">Realisasi</th>
                                              <th className="pb-2 text-center font-bold whitespace-nowrap">% Realisasi</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {k.pmlList.map((pml) => {
                                              const pmlPct = pml.total > 0 ? ((pml.realisasi / pml.total) * 100).toFixed(2) : "0.00";
                                              const pmlTargetInfo = calculateTargetAndDiff(parseFloat(pmlPct));
                                              let rowColor = "bg-amber-500/5 dark:bg-amber-950/10";
                                              if (pmlTargetInfo.isAboveTarget) {
                                                rowColor = "bg-emerald-500/5 dark:bg-emerald-950/10";
                                              } else if (pmlTargetInfo.isBelowHalfTarget) {
                                                rowColor = "bg-rose-500/5 dark:bg-rose-950/10";
                                              }

                                              return (
                                                <tr
                                                  key={pml.email}
                                                  className={`border-b border-slate-100 dark:border-slate-800/40 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors ${rowColor}`}
                                                >
                                                  <td className="py-2 font-semibold text-slate-900 dark:text-slate-100">{pml.namaPetugas}</td>
                                                  <td className="py-2 text-slate-700 dark:text-slate-300 font-normal">{pml.email}</td>
                                                  <td className="py-2 text-center">{pml.slsCount}</td>
                                                  <td className="py-2 text-center font-semibold text-slate-800 dark:text-slate-200">{pml.total}</td>
                                                  <td className="py-2 text-center text-amber-600 dark:text-amber-500/90">{pml.open_count}</td>
                                                  <td className="py-2 text-center text-blue-600 dark:text-blue-500/90">{pml.draft_count}</td>
                                                  <td className="py-2 text-center text-teal-600 dark:text-teal-500/90">{pml.submitted_pencacah}</td>
                                                  <td className="py-2 text-center text-teal-500/80 dark:text-teal-400/80">{pml.submitted_respondent}</td>
                                                  <td className="py-2 text-center text-red-655 dark:text-red-500/95">{pml.rejected_pengawas}</td>
                                                  <td className="py-2 text-center text-red-600/85 dark:text-red-400/85">{pml.rejected_admin}</td>
                                                  <td className="py-2 text-center text-emerald-600 dark:text-emerald-500/90">{pml.approved_pengawas}</td>
                                                  <td className="py-2 text-center text-emerald-500/85 dark:text-emerald-450/85">{pml.completed_admin}</td>
                                                  <td className="py-2 text-center text-emerald-500/75 dark:text-emerald-400/75">{pml.edited_admin}</td>
                                                  <td className="py-2 text-center text-rose-600 dark:text-rose-500/90">{pml.revoked_pengawas}</td>
                                                  <td className="py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{pml.progress}</td>
                                                  <td className="py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{pml.realisasi}</td>
                                                  <td className="py-2 text-center">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                      <span className={`inline-flex px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                                                        pmlTargetInfo.isAboveTarget
                                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
                                                          : pmlTargetInfo.isBelowHalfTarget
                                                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20"
                                                          : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
                                                      }`}>
                                                        {pmlPct}%
                                                      </span>
                                                      <span className={`text-[8px] font-bold ${
                                                        pmlTargetInfo.isAboveTarget
                                                          ? "text-emerald-600 dark:text-emerald-450"
                                                          : pmlTargetInfo.isBelowHalfTarget
                                                          ? "text-rose-500 dark:text-rose-405"
                                                          : "text-amber-600 dark:text-amber-500"
                                                      }`}>
                                                        {pmlTargetInfo.diff >= 0 
                                                          ? `+${pmlTargetInfo.diff.toFixed(1)}%` 
                                                          : `${pmlTargetInfo.diff.toFixed(1)}%`}
                                                      </span>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )
                    ) : activeTab === "prioritas" ? (
                      filteredPrioritySLS.length === 0 ? (
                        <tr>
                          <td colSpan={20} className="py-10 text-center text-slate-700 dark:text-slate-300 text-xs">
                            Tidak ada data SLS Prioritas yang cocok dengan filter atau pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        filteredPrioritySLS.map((item, index) => {
                          const pctRealisasi = item.total > 0 ? ((item.realisasi / item.total) * 100).toFixed(2) : "0.00";
                          return (
                            <tr
                              key={item.slsCode}
                              className="group border-b border-orange-500/20 dark:border-orange-500/10 bg-orange-500/5 dark:bg-orange-950/10 hover:bg-orange-500/10 dark:hover:bg-orange-950/20 transition-colors text-xs border-l-4 border-l-orange-500"
                            >
                              <td className="py-3 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                                {index + 1}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {item.slsCode}
                              </td>
                              <td className="py-3 px-4 font-normal text-slate-700 dark:text-slate-300">
                                {formatKecName(item.namaKec)}
                              </td>
                              <td className="py-3 px-4 font-normal text-slate-700 dark:text-slate-300">
                                {item.koseka}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                {item.pencacah}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                {item.pengawas}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{item.total}</td>
                              <td className="py-3 px-3 text-center font-normal text-amber-600 dark:text-amber-500/90">{item.open_count}</td>
                              <td className="py-3 px-3 text-center font-normal text-blue-600 dark:text-blue-500/90">{item.draft_count}</td>
                              <td className="py-3 px-3 text-center font-normal text-teal-600 dark:text-teal-500/90">{item.submitted_pencacah}</td>
                              <td className="py-3 px-3 text-center font-normal text-teal-500/80 dark:text-teal-400/80">{item.submitted_respondent}</td>
                              <td className="py-3 px-3 text-center font-normal text-red-650 dark:text-red-500/90">{item.rejected_pengawas}</td>
                              <td className="py-3 px-3 text-center font-normal text-red-600/80 dark:text-red-400/80">{item.rejected_admin}</td>
                              <td className="py-3 px-3 text-center font-normal text-emerald-600 dark:text-emerald-500/90">{item.approved_pengawas}</td>
                              <td className="py-3 px-3 text-center font-normal text-emerald-500/80 dark:text-emerald-450/85">{item.completed_admin}</td>
                              <td className="py-3 px-3 text-center font-normal text-emerald-600/70 dark:text-emerald-400/70">{item.edited_admin}</td>
                              <td className="py-3 px-3 text-center font-normal text-rose-600 dark:text-rose-500/90">{item.revoked_pengawas}</td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{item.progress}</td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{item.realisasi}</td>
                              <td className="py-3 px-4 text-center sticky right-0 z-10 border-l border-slate-200 dark:border-slate-800 bg-[#fffbf6] dark:bg-[#15100d] group-hover:bg-[#ffebd6] dark:group-hover:bg-[#281a10] transition-colors">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full font-extrabold text-xs bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/20`}>
                                  {pctRealisasi}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )
                    ) : (
                      filteredOfficers.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="py-10 text-center text-slate-700 dark:text-slate-300 text-xs">
                            Tidak ada data petugas yang cocok dengan filter atau pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        filteredOfficers.map((o, index) => {
                          const isRed = activeTab === "pcl" ? isPclRed(o) : isPmlRed(o);
                          const isExpanded = expandedRows.has(o.email);
                          const pctRealisasi = o.total > 0 ? ((o.realisasi / o.total) * 100).toFixed(2) : "0.00";
                          const targetInfo = calculateTargetAndDiff(parseFloat(pctRealisasi));
                          let rowColor = "bg-amber-500/5 dark:bg-amber-950/10";
                          if (targetInfo.isAboveTarget) {
                            rowColor = "bg-emerald-500/5 dark:bg-emerald-950/10";
                          } else if (targetInfo.isBelowHalfTarget || isRed) {
                            rowColor = "bg-rose-500/5 dark:bg-rose-950/10";
                          }

                          return (
                            <React.Fragment key={o.email}>
                              {/* Officer Summary Row */}
                              <tr
                                className={`group border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors cursor-pointer text-xs ${rowColor}`}
                                onClick={() => toggleRow(o.email)}
                              >
                                <td className="py-3 px-4 text-center">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-4 font-semibold">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">{o.namaPetugas}</div>
                                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-normal mt-0.5">{o.email}</div>
                                </td>
                                <td className="py-3 px-4 font-normal">{formatKecName(o.namaKec)}</td>
                                <td className="py-3 px-4 font-normal">{o.koseka}</td>
                                <td className="py-3 px-4 text-center font-normal">{o.slsList.length}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{o.total}</td>
                                <td className="py-3 px-3 text-center font-normal text-amber-600 dark:text-amber-500/90">{o.open_count}</td>
                                <td className="py-3 px-3 text-center font-normal text-blue-600 dark:text-blue-500/90">{o.draft_count}</td>
                                <td className="py-3 px-3 text-center font-normal text-teal-600 dark:text-teal-500/90">{o.submitted_pencacah}</td>
                                <td className="py-3 px-3 text-center font-normal text-teal-500/80 dark:text-teal-400/80">{o.submitted_respondent}</td>
                                <td className="py-3 px-3 text-center font-normal text-red-600 dark:text-red-500/90">{o.rejected_pengawas}</td>
                                <td className="py-3 px-3 text-center font-normal text-red-550/80 dark:text-red-400/80">{o.rejected_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-600 dark:text-emerald-500/90">{o.approved_pengawas}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-500/80 dark:text-emerald-450/85">{o.completed_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-emerald-500/70 dark:text-emerald-400/70">{o.edited_admin}</td>
                                <td className="py-3 px-3 text-center font-normal text-rose-600 dark:text-rose-500/90">{o.revoked_pengawas}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{o.progress}</td>
                                <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">{o.realisasi}</td>
                                <td className="py-3 px-4 text-center sticky right-0 z-10 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-950 transition-colors">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full font-extrabold text-xs ${
                                      targetInfo.isAboveTarget
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
                                        : (targetInfo.isBelowHalfTarget || isRed)
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
                                    }`}>
                                      {pctRealisasi}%
                                    </span>
                                    <span className={`text-[9px] font-bold ${
                                      targetInfo.isAboveTarget
                                        ? "text-emerald-600 dark:text-emerald-450"
                                        : (targetInfo.isBelowHalfTarget || isRed)
                                        ? "text-rose-500 dark:text-rose-405"
                                        : "text-amber-600 dark:text-amber-500"
                                    }`}>
                                      {targetInfo.diff >= 0 
                                        ? `+${targetInfo.diff.toFixed(2)}% (Lebih)` 
                                        : `${targetInfo.diff.toFixed(2)}% (Kurang)`}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded SLS Detail Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/20 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                                  <td colSpan={20} className="py-4 px-8">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4 shadow-inner">
                                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-orange-500" />
                                        Detail SLS untuk {o.namaPetugas}
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {o.slsList.map((sls) => {
                                          const slsPct = sls.total > 0 ? ((sls.progress / sls.total) * 100).toFixed(2) : "0.00";
                                          return (
                                            <div
                                              key={sls.slsCode}
                                              className={`p-3.5 rounded-xl border flex flex-col gap-2.5 shadow-sm hover:shadow transition-all ${
                                                sls.isPrioritas
                                                  ? "border-orange-500/60 dark:border-orange-500/40 bg-orange-500/5 dark:bg-orange-950/10 ring-1 ring-orange-500/20"
                                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                                              }`}
                                            >
                                              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                <span className="font-bold text-xs text-slate-900 dark:text-slate-200 font-mono tracking-tight flex items-center gap-1.5">
                                                  {sls.slsCode}
                                                  {sls.isPrioritas && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" title="SLS Prioritas"></span>
                                                  )}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                  {sls.isPrioritas && (
                                                    <span className="text-[8px] font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1 py-0.2 rounded uppercase tracking-wider">
                                                      Prio
                                                    </span>
                                                  )}
                                                  <span className="text-xs font-extrabold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">
                                                    {slsPct}%
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px] text-slate-700 dark:text-slate-400 font-medium">
                                                <div className="flex justify-between col-span-2 border-b border-slate-100 dark:border-slate-800/60 pb-1">
                                                  <span>Target:</span>
                                                  <span className="font-extrabold text-slate-800 dark:text-slate-300">{sls.total}</span>
                                                </div>
                                                <div className="flex justify-between text-amber-600 dark:text-amber-500">
                                                  <span>Open:</span>
                                                  <span className="font-bold">{sls.open_count}</span>
                                                </div>
                                                <div className="flex justify-between text-blue-600 dark:text-blue-500">
                                                  <span>Draft:</span>
                                                  <span className="font-bold">{sls.draft_count}</span>
                                                </div>
                                                <div className="flex justify-between text-teal-600 dark:text-teal-500">
                                                  <span>Sub PPL:</span>
                                                  <span className="font-bold">{sls.submitted_pencacah}</span>
                                                </div>
                                                <div className="flex justify-between text-teal-500/80 dark:text-teal-400/80">
                                                  <span>Sub Resp:</span>
                                                  <span className="font-bold">{sls.submitted_respondent}</span>
                                                </div>
                                                <div className="flex justify-between text-red-650 dark:text-red-500/90">
                                                  <span>Rej PML:</span>
                                                  <span className="font-bold">{sls.rejected_pengawas}</span>
                                                </div>
                                                <div className="flex justify-between text-red-600/80 dark:text-red-400/80">
                                                  <span>Rej Kab:</span>
                                                  <span className="font-bold">{sls.rejected_admin}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-600 dark:text-emerald-500">
                                                  <span>App PML:</span>
                                                  <span className="font-bold">{sls.approved_pengawas}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-500/80 dark:text-emerald-450/85">
                                                  <span>Comp Kab:</span>
                                                  <span className="font-bold">{sls.completed_admin}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-500/70 dark:text-emerald-400/70">
                                                  <span>Edit Kab:</span>
                                                  <span className="font-bold">{sls.edited_admin}</span>
                                                </div>
                                                <div className="flex justify-between text-rose-600 dark:text-rose-500/90">
                                                  <span>Revoked:</span>
                                                  <span className="font-bold">{sls.revoked_pengawas}</span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
