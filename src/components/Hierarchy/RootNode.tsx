// components/Hierarchy/RootNode.tsx
import { Handle, Position } from "reactflow";

export function RootNode() {
    return (
        <div className="rounded-lg border-2 border-gray-800 bg-gray-900 text-white shadow-md px-4 py-2 font-semibold text-sm">
            Organization
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}