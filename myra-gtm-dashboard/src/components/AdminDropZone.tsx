"use client";

import { useState } from "react";
import { saveOrgs } from "@/lib/actions";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";
import Link from "next/link";

export function AdminDropZone() {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
    const [count, setCount] = useState(0);

    async function handleSave() {
        setStatus("saving");
        const res = await saveOrgs(input);
        if (res.success) {
            setCount(res.count);
            setStatus("success");
            setTimeout(() => setStatus("idle"), 3000);
            setInput("");
        }
    }

    return (
        <div className="w-full max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/" className="text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
                <h1 className="text-xl font-bold">Data Drop Zone</h1>
            </div>

            <div className="glass-card rounded-2xl p-1 bg-white">
                <div className="px-4 py-3 border-b border-border-light bg-bg-secondary/30 text-xs font-mono text-text-secondary flex justify-between">
                    <span>Format: Name | Cost | Users | Stage</span>
                    <span>Example: "Acme Corp, 1200, 5, paying"</span>
                </div>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste your chaotic data here..."
                    className="w-full h-64 p-4 text-sm font-mono focus:outline-none resize-none bg-transparent"
                />
                <div className="p-3 border-t border-border-light bg-bg-secondary/20 flex justify-between items-center">
                    <div className="text-xs text-text-tertiary">
                        {status === "success" && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Processed {count} records</span>}
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={status === "saving" || !input.trim()}
                        className="px-4 py-2 bg-text-primary text-white rounded-lg text-sm font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {status === "saving" ? "Crunching..." : <><Save className="w-4 h-4" /> Parse & Save</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
