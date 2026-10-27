import { Node, Edge } from "reactflow";

export function buildFlow(
    hierarchyData: any[],
    expandedDept: Set<number>
): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
        id: "root",
        type: "root",
        data: {},
        position: { x: 0, y: 0 },
    });

    hierarchyData.forEach((pd) => {
        const pdId = `pd-${pd.primaryDepartmentId}`;

        nodes.push({
            id: pdId,
            type: "primaryDepartment",
            data: pd,
            position: { x: 0, y: 0 },
        });

        edges.push({
            id: `e-root-${pdId}`,
            source: "root",
            target: pdId,
        });

        pd.departments?.forEach((dept: any) => {
            const deptId = `dept-${dept.departmentID}`;

            nodes.push({
                id: deptId,
                type: "department",
                data: dept,
                position: { x: 0, y: 0 },
            });

            edges.push({
                id: `e-${pdId}-${deptId}`,
                source: pdId,
                target: deptId,
            });

            if (expandedDept.has(dept.departmentID)) {
                dept.users?.forEach((u: any) => {
                    const userId = `user-${u.userID}`;

                    nodes.push({
                        id: userId,
                        type: "user",
                        data: u,
                        position: { x: 0, y: 0 },
                    });

                    edges.push({
                        id: `e-${deptId}-${userId}`,
                        source: deptId,
                        target: userId,
                    });
                });
            }
        });
    });

    return { nodes, edges };
}