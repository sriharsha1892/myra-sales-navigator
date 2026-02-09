"use client";

import { useEffect, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import type { Contact, VerificationResult } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";

export function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function applyTemplateLocal(template: string, contact: Contact & { companyName: string }): string {
  return template
    .replace(/\{\{first_name\}\}/g, contact.firstName)
    .replace(/\{\{last_name\}\}/g, contact.lastName)
    .replace(/\{\{email\}\}/g, contact.email ?? "")
    .replace(/\{\{title\}\}/g, contact.title)
    .replace(/\{\{company\}\}/g, contact.companyName)
    .replace(/\{\{phone\}\}/g, contact.phone ?? "");
}

function buildContactPayload(c: Contact) {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    title: c.title,
    companyName: c.companyName,
    companyDomain: c.companyDomain,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    seniority: c.seniority,
    emailConfidence: c.emailConfidence,
    sources: c.sources,
  };
}

export function useExport() {
  const viewMode = useStore((s) => s.viewMode);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const exportState = useStore((s) => s.exportState);
  const setExportState = useStore((s) => s.setExportState);
  const triggerExport = useStore((s) => s.triggerExport);
  const setTriggerExport = useStore((s) => s.setTriggerExport);
  const userCopyFormat = useStore((s) => s.userCopyFormat);
  const adminConfig = useStore((s) => s.adminConfig);
  const addProgressToast = useStore((s) => s.addProgressToast);
  const addToast = useStore((s) => s.addToast);
  const { notify } = useBrowserNotifications();

  const getSelectedContacts = useCallback((): Contact[] => {
    // Gather contacts for selected companies, plus any individually selected contacts
    const contacts: Contact[] = [];
    const seen = new Set<string>();
    selectedCompanyDomains.forEach((domain) => {
      const domainContacts = contactsByDomain[domain] ?? [];
      for (const c of domainContacts) {
        seen.add(c.id);
        contacts.push(c);
      }
    });
    // Also include individually selected contacts (from inline expansion)
    if (selectedContactIds.size > 0) {
      const allContacts = Object.values(contactsByDomain).flat();
      for (const c of allContacts) {
        if (selectedContactIds.has(c.id) && !seen.has(c.id)) {
          contacts.push(c);
        }
      }
    }
    return contacts;
  }, [selectedContactIds, selectedCompanyDomains, contactsByDomain]);

  const executeExport = useCallback(async (contacts: Contact[], mode: "csv" | "clipboard" | "excel") => {
    if (contacts.length === 0) {
      addToast({ message: "No contacts to export", type: "warning" });
      return;
    }

    const handle = addProgressToast(`Exporting ${contacts.length} contacts...`);
    const userName = useStore.getState().userName ?? "Unknown";
    const companyDomain = contacts[0]?.companyDomain;
    const companyDomains = [...new Set(contacts.map((c) => c.companyDomain).filter(Boolean))];
    const payloads = contacts.map(buildContactPayload);

    try {
      if (mode === "clipboard") {
        const format = adminConfig.copyFormats.find((f) => f.id === userCopyFormat);
        const template = format?.template ?? "{{first_name}} {{last_name}} <{{email}}>";

        try {
          const res = await fetch("/api/export/clipboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contacts: payloads, format: template, companyDomain, companyDomains, userName }),
          });
          if (!res.ok) {
            if (res.status === 429) throw new Error("rate_limited");
            if (res.status === 408) throw new Error("timeout");
            throw new Error("Server error");
          }
          const { text, count, skipped } = await res.json();
          await navigator.clipboard.writeText(text);
          const skipMsg = skipped > 0 ? ` (${skipped} skipped — no email)` : "";
          handle.resolve(`Copied ${count} contacts to clipboard${skipMsg}`);
          notify("Export complete", `Copied ${count} contacts to clipboard${skipMsg}`);
        } catch {
          // H3: Fallback notification
          addToast({ message: pick("export_fallback"), type: "info", duration: 3000 });
          // Fallback: client-side formatting
          const lines = contacts
            .filter((c) => c.email)
            .map((c) => applyTemplateLocal(template, c));
          await navigator.clipboard.writeText(lines.join("\n"));
          handle.resolve(`Copied ${lines.length} contacts to clipboard`);
          notify("Export complete", `Copied ${lines.length} contacts to clipboard`);
        }
      } else if (mode === "excel") {
        // Excel export using ExcelJS (client-side)
        try {
          const ExcelJS = (await import("exceljs")).default;
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet("Contacts");
          const allExcelColumns = [
            { header: "First Name", key: "firstName", width: 15 },
            { header: "Last Name", key: "lastName", width: 15 },
            { header: "Email", key: "email", width: 30 },
            { header: "Title", key: "title", width: 25 },
            { header: "Company", key: "company", width: 25 },
            { header: "Phone", key: "phone", width: 18 },
            { header: "Seniority", key: "seniority", width: 12 },
            { header: "Confidence", key: "confidence", width: 12 },
            { header: "Sources", key: "sources", width: 15 },
            { header: "In Freshsales", key: "inFreshsales", width: 14 },
          ];
          const csvColumns = adminConfig.exportSettings?.csvColumns;
          sheet.columns = csvColumns?.length
            ? allExcelColumns.filter((col) => csvColumns.includes(col.key))
            : allExcelColumns;
          for (const c of contacts) {
            sheet.addRow({
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email ?? "",
              title: c.title,
              company: c.companyName,
              phone: c.phone ?? "",
              seniority: c.seniority,
              confidence: c.emailConfidence,
              sources: (c.sources ?? []).join(", "),
              inFreshsales: c.sources?.includes("freshsales") ? "Yes" : "No",
            });
          }
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          handle.resolve(`Exported ${contacts.length} contacts to Excel`);
          notify("Export complete", `Exported ${contacts.length} contacts to Excel`);
        } catch {
          handle.reject("Excel export failed");
          notify("Export failed", "Excel export failed");
        }
      } else {
        // CSV export — respect admin csvColumns
        const csvColumns = adminConfig.exportSettings?.csvColumns;

        try {
          const res = await fetch("/api/export/csv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contacts: payloads, companyDomain, companyDomains, userName, csvColumns }),
          });
          if (!res.ok) {
            if (res.status === 429) throw new Error("rate_limited");
            if (res.status === 408) throw new Error("timeout");
            throw new Error("Server error");
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          handle.resolve(`Exported ${contacts.length} contacts to CSV`);
          notify("Export complete", `Exported ${contacts.length} contacts to CSV`);
        } catch {
          // H3: Fallback notification
          addToast({ message: pick("export_fallback"), type: "info", duration: 3000 });
          // Fallback: client-side CSV generation
          const csvRows = [
            ["First Name", "Last Name", "Email", "Title", "Company", "Phone", "Confidence", "In Freshsales"].join(","),
            ...contacts.map((c) =>
              [c.firstName, c.lastName, c.email ?? "", c.title, c.companyName, c.phone ?? "", String(c.emailConfidence), c.sources?.includes("freshsales") ? "Yes" : "No"].map(escapeCsvField).join(",")
            ),
          ];
          const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          handle.resolve(`Exported ${contacts.length} contacts to CSV`);
          notify("Export complete", `Exported ${contacts.length} contacts to CSV`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error && err.message === "rate_limited"
        ? pick("error_rate_limited")
        : err instanceof Error && err.message === "timeout"
          ? pick("error_timeout")
          : "Export failed";
      handle.reject(msg);
      notify("Export failed", msg);
      setExportState(null);
      return;
    }

    // Log exported contacts to Supabase
    try {
      const exportPayload = contacts
        .filter((c) => c.email)
        .map((c) => ({ email: c.email, name: `${c.firstName} ${c.lastName}` }));
      if (exportPayload.length > 0) {
        fetch("/api/contact/export-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: exportPayload,
            exportedBy: userName,
            exportFormat: mode,
            companyDomain,
          }),
        }).catch(() => { /* silent */ });
      }
    } catch { /* silent */ }

    // Teams notification (fire-and-forget)
    try {
      fetch("/api/teams/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "export",
          payload: {
            userName,
            contactCount: contacts.length,
            companyDomain: companyDomain ?? "multiple",
            format: mode,
          },
        }),
      }).catch(() => { /* silent */ });
    } catch { /* silent */ }

    setExportState(null);
  }, [adminConfig, userCopyFormat, addProgressToast, addToast, setExportState, notify]);

  const initiateExport = useCallback((mode: "csv" | "clipboard" | "excel") => {
    // Fix 3: If dossier is open and no companies bulk-selected, export dossier company's contacts
    const currentState = useStore.getState();
    if (currentState.selectedCompanyDomain && currentState.slideOverOpen && selectedCompanyDomains.size === 0) {
      const dossierContacts = currentState.contactsByDomain[currentState.selectedCompanyDomain] ?? [];
      if (dossierContacts.length === 0) {
        addToast({ message: "No contacts available for this company", type: "warning" });
        return;
      }
      executeExport(dossierContacts, mode);
      return;
    }

    if (viewMode === "companies" && selectedCompanyDomains.size > 0) {
      const contacts = getSelectedContacts();

      // Fix 1: Check if ANY contacts have email before opening the picker
      const contactsWithEmail = contacts.filter((c) => c.email);
      if (contactsWithEmail.length === 0) {
        addToast({
          message: "None of the contacts have email addresses yet. Try refreshing the company dossier or using 'Find Email' on individual contacts.",
          type: "warning",
          duration: 6000,
        });
        return;
      }

      // Auto-export bypass: skip contact picker when preference is set
      const autoExport = typeof window !== "undefined" && localStorage.getItem("nav_auto_export") === "1";
      if (autoExport) {
        // Still warn about invalid/missing emails
        const invalidCount = contacts.filter(
          (c) => c.verificationStatus === "invalid" || !c.email
        ).length;
        if (invalidCount > 0) {
          addToast({
            message: `${invalidCount} contact${invalidCount > 1 ? "s" : ""} with invalid/missing email${invalidCount > 1 ? "s" : ""} will be included`,
            type: "warning",
            duration: 4000,
          });
        }
        executeExport(contacts, mode);
        return;
      }

      // Open contact picker
      setExportState({
        step: "picking",
        contactIds: contacts.map((c) => c.id),
        verificationResults: new Map(),
        verifiedCount: 0,
        totalCount: contacts.length,
        mode,
      });
    } else {
      const contacts = getSelectedContacts();
      if (contacts.length === 0) {
        addToast({ message: "Select companies to export", type: "warning" });
        return;
      }
      // Warn about invalid/missing emails
      const invalidCount = contacts.filter(
        (c) => c.verificationStatus === "invalid" || !c.email
      ).length;
      if (invalidCount > 0) {
        addToast({
          message: `${invalidCount} contact${invalidCount > 1 ? "s" : ""} with invalid/missing email${invalidCount > 1 ? "s" : ""} will be included`,
          type: "warning",
          duration: 4000,
        });
      }
      executeExport(contacts, mode);
    }
  }, [viewMode, selectedCompanyDomains, getSelectedContacts, setExportState, executeExport, addToast]);

  const exportPickedContacts = useCallback(async (contactIds: string[]) => {
    const allContacts = Object.values(contactsByDomain).flat();
    let contacts = allContacts.filter((c) => contactIds.includes(c.id));
    const mode = exportState?.mode ?? "clipboard";

    const shouldVerify = adminConfig.exportSettings?.autoVerifyOnExport ?? false;
    const threshold = adminConfig.exportSettings?.confidenceThreshold ?? 0;

    if (shouldVerify) {
      const emailsToVerify = contacts
        .map((c) => c.email)
        .filter((e): e is string => !!e);

      if (emailsToVerify.length > 0) {
        setExportState({
          step: "verify",
          contactIds,
          verificationResults: new Map(),
          verifiedCount: 0,
          totalCount: emailsToVerify.length,
          mode,
        });

        try {
          const res = await fetch("/api/contact/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails: emailsToVerify }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? `Verification failed (${res.status})`);
          }

          const { results } = (await res.json()) as { results: VerificationResult[] };

          // Build results map and update export state
          const resultsMap = new Map<string, VerificationResult>();
          for (const r of results) {
            resultsMap.set(r.email, r);
          }

          setExportState({
            step: "exporting",
            contactIds,
            verificationResults: resultsMap,
            verifiedCount: results.length,
            totalCount: emailsToVerify.length,
            mode,
          });

          // Update contact confidence from verification results
          contacts = contacts.map((c) => {
            const vr = c.email ? resultsMap.get(c.email) : undefined;
            if (vr) {
              return { ...c, emailConfidence: vr.score };
            }
            return c;
          });

          // Fix 4: Filter out contacts below confidence threshold and notify about dropped count
          if (threshold > 0) {
            const beforeCount = contacts.length;
            contacts = contacts.filter((c) => c.emailConfidence >= threshold);
            const droppedCount = beforeCount - contacts.length;
            if (droppedCount > 0) {
              addToast({
                message: `${droppedCount} contact${droppedCount > 1 ? "s" : ""} removed (email confidence below ${threshold}%)`,
                type: "info",
              });
            }
          }

          notify("Verification complete", `${results.length} emails verified`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Verification failed";
          addToast({ message: msg, type: "warning" });
          notify("Verification failed", msg);
          // Proceed with unverified contacts rather than blocking export
        }
      }
    }

    setExportState(null);
    executeExport(contacts, mode);
  }, [contactsByDomain, exportState, executeExport, setExportState, adminConfig, addToast, notify]);

  // Watch for Cmd+E trigger
  useEffect(() => {
    if (triggerExport) {
      initiateExport(triggerExport);
      setTriggerExport(null);
    }
  }, [triggerExport, initiateExport, setTriggerExport]);

  return {
    initiateExport,
    executeExport,
    exportPickedContacts,
    exportState,
    setExportState,
  };
}
