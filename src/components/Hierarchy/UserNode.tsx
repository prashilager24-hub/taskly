import { Handle, Position } from "reactflow";

export function UserNode({ data }: any) {

    return (

        <div className="rounded border bg-gray-50 p-2 shadow w-52">

            <Handle type="target" position={Position.Top} />

            <div className="font-medium">
                {data.name}
            </div>

            <div className="text-xs">
                {data.userEmail}
            </div>

            <div className="text-xs text-gray-500">
                {data.roleName}
            </div>

        </div>

    );

}