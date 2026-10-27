import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
    userID: number;
    userName: string;
    userEmail: string;
    departmentName: string;
    departmentID: number;
    role: string;
    roleID: number;
    newStatus: string;
    isActive: boolean;
    userCreateTime: string;
}

interface DashboardStore {
    dateModification: boolean;
    setDateModification: (value: boolean) => void;
    toggleDateModification: () => void;
    allUser: User[];
    setAllUser: (data: User[]) => void;
}

export const useDashboardStore = create<DashboardStore>()(
    persist(
        (set) => ({
            dateModification: true,
            setDateModification: (value) => set({ dateModification: value }),
            toggleDateModification: () =>
                set((state) => ({ dateModification: !state.dateModification })),
            allUser: [],
            setAllUser: (data) => set({ allUser: data }),
        }),
        {
            name: "dashboard-storage", // localStorage key
        }
    )
);