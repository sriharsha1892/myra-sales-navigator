"use server";

import { revalidatePath } from "next/cache";
import { getGTMData, updateGTMData, Org } from "./data";
import { redirect } from "next/navigation";

export async function saveOrgs(text: string) {
    const data = await getGTMData();
    const currentOrgs = [...data.orgs];

    // "Magic" Parser (Simple Heuristic for now)
    // Expected formats: 
    // "Name, 5 users, Paying, 1200"
    // "Name \t 5 \t Paying \t 1200"

    const lines = text.split("\n").filter(l => l.trim().length > 0);
    let addedCount = 0;

    for (const line of lines) {
        // Attempt to split by tab or comma
        const parts = line.split(/[\t,]+/).map(s => s.trim());

        if (parts.length >= 3) {
            // Very naive mapping: Name, Users, Cost, Stage?
            // Let's assume the user pastes columns: Name | Cost | Users | Stage
            // Or we try to detect.

            const name = parts[0];
            // Find a number that might be cost vs users. Users usually small, Cost large.
            const numbers = parts.filter(p => !isNaN(parseFloat(p.replace(/[^0-9.]/g, ""))));
            const strings = parts.filter(p => isNaN(parseFloat(p.replace(/[^0-9.]/g, ""))));

            let cost = 0;
            let users = 0;

            if (numbers.length >= 2) {
                const n1 = parseFloat(numbers[0].replace(/[^0-9.]/g, ""));
                const n2 = parseFloat(numbers[1].replace(/[^0-9.]/g, ""));
                cost = Math.max(n1, n2); // Assumption: Cost > Users
                users = Math.min(n1, n2);
            } else if (numbers.length === 1) {
                cost = parseFloat(numbers[0].replace(/[^0-9.]/g, ""));
            }

            // Detect stage
            const lowerLine = line.toLowerCase();
            let stage: Org['stage'] = "prospect";
            if (lowerLine.includes("pay")) stage = "paying";
            if (lowerLine.includes("trial")) stage = "trial";
            if (lowerLine.includes("lost")) stage = "lost";

            // Upsert
            const existingIndex = currentOrgs.findIndex(o => o.name.toLowerCase() === name.toLowerCase());
            if (existingIndex >= 0) {
                currentOrgs[existingIndex] = {
                    ...currentOrgs[existingIndex],
                    cost,
                    users: users || currentOrgs[existingIndex].users,
                    stage
                };
            } else {
                currentOrgs.push({
                    name,
                    cost,
                    users: users || 1,
                    stage,
                    conversations: 0 // Default
                });
            }
            addedCount++;
        }
    }

    // Update total cost KPI
    const newTotalCost = currentOrgs
        .filter(o => o.stage === "paying" || o.stage === "prospect") // User logic: "Summation of tracked accounts"
        .reduce((acc, o) => acc + o.cost, 0);

    await updateGTMData({ orgs: currentOrgs, kpis: { ...data.kpis, totalCost: newTotalCost } });
    revalidatePath("/");
    return { success: true, count: addedCount };
}
