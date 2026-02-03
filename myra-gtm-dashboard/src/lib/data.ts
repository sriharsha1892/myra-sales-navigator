"use server";

import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "gtm.json");

export interface GTMData {
    lastUpdated: string;
    kpis: {
        totalCost: number;
        payingRevenue: number;
        activeUsers: number;
    };
    pipeline: {
        inbound: { total: number; active: number; junk: number };
        outbound: { leads: number; reached: number; followed: number; qualified: number };
    };
    orgs: Org[];
}

export interface Org {
    name: string;
    stage: "paying" | "prospect" | "trial" | "lost" | "dormant";
    users: number;
    cost: number;
    conversations: number;
    logo?: string;
}

export async function getGTMData(): Promise<GTMData> {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (error) {
        console.error("Failed to read GTM data:", error);
        // Return empty fallback
        return {
            lastUpdated: new Date().toISOString(),
            kpis: { totalCost: 0, payingRevenue: 0, activeUsers: 0 },
            pipeline: {
                inbound: { total: 0, active: 0, junk: 0 },
                outbound: { leads: 0, reached: 0, followed: 0, qualified: 0 },
            },
            orgs: [],
        };
    }
}

export async function updateGTMData(newData: Partial<GTMData>): Promise<void> {
    const current = await getGTMData();
    const updated = { ...current, ...newData, lastUpdated: new Date().toISOString() };
    await fs.writeFile(DATA_FILE, JSON.stringify(updated, null, 2));
}

export async function addOrg(org: Org): Promise<void> {
    const data = await getGTMData();
    data.orgs.push(org);
    await updateGTMData(data);
}
