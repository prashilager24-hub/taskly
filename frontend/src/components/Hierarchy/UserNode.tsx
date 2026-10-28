import { Handle, Position } from "reactflow";

export function UserNode({ data }: any) {

    return (

        <div className="rounded border bg-ink-50 dark:bg-ink-950 p-2 shadow w-52">

            <Handle type="target" position={Position.Top} />

            <div className="font-medium">
                {data.name}
            </div>

            <div className="text-xs">
                {data.userEmail}
            </div>

            <div className="text-xs text-ink-500 dark:text-ink-400">
                {data.roleName}
            </div>

        </div>

    );

}