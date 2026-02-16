import { ProspectListView } from "@/components/navigator/layout/ProspectListView";

export default function ProspectsPage() {
  return (
    <div className="flex h-full flex-col bg-surface-0">
      <div className="flex-shrink-0 border-b border-surface-3 px-4 py-3">
        <h1 className="font-display text-lg text-text-primary">My Prospects</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ProspectListView />
      </div>
    </div>
  );
}
