import { hrms } from "@/peoplehub/modules/data/hrms"
import { assets, finance, misc, talent } from "@/peoplehub/modules/data/operations"
import { performance } from "@/peoplehub/modules/data/performance"
import { engagement } from "@/peoplehub/modules/data/engagement"

/** Route path (without leading slash) → screen config. */
export const MODULES = { ...hrms, ...performance, ...finance, ...talent, ...assets, ...misc, ...engagement }

export type ModuleId = keyof typeof MODULES
