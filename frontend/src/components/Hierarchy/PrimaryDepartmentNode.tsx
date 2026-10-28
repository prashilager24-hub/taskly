import { Handle, Position } from "reactflow";

export function PrimaryDepartmentNode({ data }: any) {
    return (
        <div className="rounded-xl border-2 border-brand-500 bg-white dark:bg-ink-900 shadow-md p-3 min-w-[220px]">

            <Handle type="target" position={Position.Top} />

            <div className="font-semibold">
                {data.primaryDepartmentName}
            </div>

            <div className="text-xs text-ink-500 dark:text-ink-400">
                {data.type}
            </div>

            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}