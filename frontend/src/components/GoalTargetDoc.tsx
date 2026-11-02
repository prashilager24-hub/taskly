import { useState } from "react";
import { ChevronDown, Download, ExternalLink, FileSpreadsheet } from "lucide-react";

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Modal, ModalBody, ModalContent, ModalHeader, Tooltip } from "@/components/ui";

// "Targets-Goals-Taskly" sheet. Topbar document icon: opens it in a modal; from there it can be
// opened in a new tab or downloaded. The sheet is shared by link, so these open for anyone who has it.
const SHEET_ID = "1qoniokvvEugnYDyaISblNbrCoeH7cJrdt_HksaWT-Vs";
const GID = "1681648508";
const BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
const PREVIEW = `${BASE}/htmlview?gid=${GID}`;
const EDIT = `${BASE}/edit?gid=${GID}`;
const DOWNLOADS = [
    { key: "xlsx", label: "Excel (.xlsx), all sheets", href: `${BASE}/export?format=xlsx` },
    { key: "pdf", label: "PDF, this sheet", href: `${BASE}/export?format=pdf&gid=${GID}` },
    { key: "csv", label: "CSV, this sheet", href: `${BASE}/export?format=csv&gid=${GID}` },
];

const openTab = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

export default function GoalTargetDoc() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Tooltip content="Goals & targets" placement="bottom">
                <Button isIconOnly size="sm" variant="light" aria-label="Open goals and targets document" onPress={() => setOpen(true)}>
                    <FileSpreadsheet size={18} />
                </Button>
            </Tooltip>

            <Modal isOpen={open} onOpenChange={setOpen} size="5xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex flex-wrap items-center justify-between gap-3 pr-12">
                        <span className="flex items-center gap-2">
                            <FileSpreadsheet size={18} className="text-brand-600" aria-hidden />
                            Goals &amp; targets
                        </span>
                        <span className="flex items-center gap-2">
                            <Button size="sm" variant="bordered" startContent={<ExternalLink size={14} />} onPress={() => openTab(EDIT)}>
                                Open in new tab
                            </Button>
                            <Dropdown placement="bottom-end">
                                <DropdownTrigger>
                                    <Button size="sm" variant="bordered" startContent={<Download size={14} />} endContent={<ChevronDown size={14} />}>
                                        Download
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Download formats" onAction={(key) => { const d = DOWNLOADS.find((x) => x.key === key); if (d) openTab(d.href); }}>
                                    {DOWNLOADS.map((d) => <DropdownItem key={d.key}>{d.label}</DropdownItem>)}
                                </DropdownMenu>
                            </Dropdown>
                        </span>
                    </ModalHeader>
                    <ModalBody className="pb-5">
                        <iframe src={PREVIEW} title="Goals and targets" className="h-[68vh] w-full border border-ink-200 bg-white dark:border-white/10" loading="lazy" />
                        <p className="text-xs text-ink-500 dark:text-ink-400">If the preview stays blank, open it in a new tab.</p>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
}
