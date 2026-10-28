// components/Hierarchy/DepartmentNode.tsx
import { Handle, Position } from "reactflow";

export function DepartmentNode({ data }: any) {
    return (
        <div className="rounded-lg border border-brand-400 bg-white dark:bg-ink-900 shadow p-3 min-w-[200px] cursor-pointer hover:shadow-md transition-shadow">
            <Handle type="target" position={Position.Top} />

            <div className="font-medium">{data.departmentName}</div>

            <div className="text-xs">EL: {data.executiveLeaderName || "—"}</div>

            <div className="text-xs text-brand-600">
                {data.users?.length || 0} users (click to toggle)
            </div>

            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}