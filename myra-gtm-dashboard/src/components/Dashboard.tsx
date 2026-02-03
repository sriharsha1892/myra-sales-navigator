"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Users, MessageSquare, DollarSign, TrendingUp, Filter } from "lucide-react";
import type { GTMData, Org } from "@/lib/data";
import clsx from "clsx";

interface DashboardProps {
    initialData: GTMData;
}

export function Dashboard({ initialData }: DashboardProps) {
    const [data] = useState<GTMData>(initialData);
    const [activeTab, setActiveTab] = useState<"paying" | "prospect" | "trial">("paying");

    const filteredOrgs = data.orgs
        .filter((o) => o.stage === activeTab)
        .sort((a, b) => b.cost - a.cost);

    const totalUsers = filteredOrgs.reduce((acc, o) => acc + o.users, 0);
    const totalCost = filteredOrgs.reduce((acc, o) => acc + o.cost, 0);

    return (
        <div className="min-h-screen p-6 md:p-10 max-w-[1600px] mx-auto grid grid-rows-[auto_1fr] gap-8">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-1">myRA GTM</h1>
                    <div className="flex items-center gap-2 text-xs text-text-secondary font-medium uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Live Dashboard
                        <span className="text-text-tertiary px-1">•</span>
                        {new Date(data.lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                </div>
                <div className="flex gap-4">
                    {/* Placeholder for future actions */}
                </div>
            </header>

            {/* KPI Bento Grid */}
            <div className="grid grid-cols-12 gap-6 h-full">
                {/* Left Column: Pipeline & Funnel (Width 4) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    <KpiCard title="Paying Customers" value={data.orgs.filter(o => o.stage === 'paying').length} delta="+2" color="text-emerald-600" />

                    <div className="glass-card rounded-2xl p-6 flex-1 flex flex-col gap-6">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Pipeline Health</h3>

                        <PipelineRow label="Active Trials" count={data.orgs.filter(o => o.stage === 'trial').length} color="bg-violet-500" />
                        <PipelineRow label="Post-Demo" count={18} color="bg-orange-500" />
                        <PipelineRow label="Demo Queued" count={17} color="bg-amber-500" />

                        <div className="h-px bg-border-light my-2" />

                        <div className="flex items-end justify-between">
                            <div>
                                <div className="text-xs text-text-tertiary uppercase font-semibold">Inbound Leads</div>
                                <div className="text-2xl font-bold mt-1">{data.pipeline.inbound.total}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-text-tertiary uppercase font-semibold">Outbound Reach</div>
                                <div className="text-2xl font-bold mt-1">{(data.pipeline.outbound.reached / 1000).toFixed(1)}k</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Main Data View (Width 8) */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    {/* Top Stats Strip */}
                    <div className="grid grid-cols-3 gap-6">
                        <StatTile
                            active={activeTab === 'paying'}
                            onClick={() => setActiveTab('paying')}
                            label="Paying Revenue"
                            value={`$${initialData.kpis.totalCost.toLocaleString()}`}
                            meta={`${data.orgs.filter(o => o.stage === 'paying').length} Orgs`}
                            theme="emerald"
                        />
                        <StatTile
                            active={activeTab === 'prospect'}
                            onClick={() => setActiveTab('prospect')}
                            label="Strong Prospects"
                            value={data.orgs.filter(o => o.stage === 'prospect').length.toString()}
                            meta="High Intent"
                            theme="blue"
                        />
                        <StatTile
                            active={activeTab === 'trial'}
                            onClick={() => setActiveTab('trial')}
                            label="Active Trials"
                            value={data.orgs.filter(o => o.stage === 'trial').length.toString()}
                            meta="Expiring Soon"
                            theme="violet"
                        />
                    </div>

                    {/* Main Table Card */}
                    <div className="glass-card rounded-2xl p-0 flex-1 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-border-light flex justify-between items-center bg-bg-secondary/30">
                            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                {activeTab === 'paying' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                {activeTab === 'prospect' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                {activeTab === 'trial' && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Organizations
                            </h3>
                            <div className="text-xs font-mono text-text-secondary">
                                {filteredOrgs.length} Records • {totalUsers} Users
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-xs text-text-tertiary border-b border-border-light/50">
                                        <th className="px-4 py-3 font-medium uppercase tracking-wider">Organization</th>
                                        <th className="px-4 py-3 font-medium uppercase tracking-wider text-right">Records</th>
                                        <th className="px-4 py-3 font-medium uppercase tracking-wider text-right">Users</th>
                                        <th className="px-4 py-3 font-medium uppercase tracking-wider text-right">Cost (Est)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence mode="popLayout">
                                        {filteredOrgs.map((org) => (
                                            <motion.tr
                                                key={org.name}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="group hover:bg-bg-hover transition-colors cursor-default rounded-lg"
                                            >
                                                <td className="px-4 py-3 font-medium text-text-primary rounded-l-lg">{org.name}</td>
                                                <td className="px-4 py-3 text-right text-text-secondary font-mono">{org.conversations.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-text-secondary font-mono">{org.users}</td>
                                                <td className="px-4 py-3 text-right font-mono font-medium rounded-r-lg">
                                                    <span className={clsx(
                                                        activeTab === 'paying' && "text-emerald-600",
                                                        activeTab === 'prospect' && "text-blue-600",
                                                        activeTab === 'trial' && "text-violet-600"
                                                    )}>
                                                        ${org.cost.toLocaleString()}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Row */}
                        <div className="px-6 py-3 border-t border-border-light bg-bg-secondary/50 text-xs font-mono flex justify-between items-center text-text-secondary">
                            <span>TOTALS</span>
                            <div className="flex gap-8">
                                <span>{filteredOrgs.reduce((a, b) => a + b.conversations, 0).toLocaleString()} recs</span>
                                <span>{totalUsers} users</span>
                                <span className="font-bold text-text-primary">${totalCost.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, delta, color }: { title: string, value: number, delta: string, color: string }) {
    return (
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowUpRight className="w-12 h-12" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">{title}</h3>
            <div className="flex items-baseline gap-3">
                <span className={clsx("text-4xl font-bold tracking-tight", color)}>{value}</span>
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{delta}</span>
            </div>
        </div>
    );
}

function PipelineRow({ label, count, color }: { label: string, count: number, color: string }) {
    return (
        <div className="flex items-center justify-between group cursor-pointer hover:bg-bg-hover transition-colors p-2 -mx-2 rounded-lg">
            <div className="flex items-center gap-3">
                <div className={clsx("w-2 h-2 rounded-full", color)} />
                <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">{label}</span>
            </div>
            <span className="text-sm font-bold text-text-primary font-mono">{count}</span>
        </div>
    );
}

function StatTile({ label, value, meta, active, onClick, theme }: any) {
    const colors = {
        emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/50', text: 'text-emerald-900', meta: 'text-emerald-600' },
        blue: { border: 'border-blue-200', bg: 'bg-blue-50/50', text: 'text-blue-900', meta: 'text-blue-600' },
        violet: { border: 'border-violet-200', bg: 'bg-violet-50/50', text: 'text-violet-900', meta: 'text-violet-600' },
    }[theme as string] || colors.emerald;

    return (
        <button
            onClick={onClick}
            className={clsx(
                "rounded-xl p-5 text-left transition-all duration-200 border-2",
                active
                    ? clsx("bg-white shadow-lg scale-105 z-10", colors.border)
                    : "bg-white/40 border-transparent hover:bg-white/60 hover:scale-[1.02]"
            )}
        >
            <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">{label}</div>
            <div className={clsx("text-2xl font-bold mb-1", active ? colors.text : "text-text-primary")}>{value}</div>
            <div className={clsx("text-[10px] font-medium uppercase tracking-wide", active ? colors.meta : "text-text-tertiary")}>{meta}</div>
        </button>
    );
}
