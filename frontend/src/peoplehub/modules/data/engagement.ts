import { Download, FileImage, Lightbulb, Palette, Rocket, Send, ThumbsUp, Upload } from "lucide-react";
import { cycle, PEOPLE } from "@/peoplehub/mocks/people";
import type { ModuleConfig } from "@/peoplehub/modules/types";

/* People Hub modules added after the blueprint: Ideabox and Brand Kit (sample data, same screen format as the rest). */

const IDEA_CATEGORIES = ["Process", "Product", "Workplace", "Cost saving", "Culture", "Customer"];

export const engagement: Record<string, ModuleConfig> = {
  ideabox: {
    eyebrow: "Ideabox",
    title: "Ideabox",
    description: "Share ideas to make work, products and the workplace better. Colleagues vote, a review panel picks the ones to build.",
    employee: { title: "Ideabox", description: "Share an idea or vote for the ones you like. The most-voted ideas go to the review panel every month.", scope: "all" },
    approvals: true,
    stats: [
      { label: "Ideas this quarter", value: "64", delta: "+18", trend: "up", hint: "vs last quarter", icon: Lightbulb },
      { label: "Votes cast", value: "1,920", icon: ThumbsUp },
      { label: "Under review", value: "9", hint: "panel meets 1 Dec", icon: Send },
      { label: "Implemented", value: "12", hint: "this year", icon: Rocket },
    ],
    actions: [
      {
        label: "Share an idea",
        icon: Lightbulb,
        form: {
          title: "Share an idea",
          description: "Keep it short: the problem, your idea, and who it helps. You can add detail later.",
          submitLabel: "Submit idea",
          status: "Submitted",
          success: "Idea submitted. Colleagues can vote on it now.",
          fields: [
            { name: "title", label: "Idea title", type: "text", required: true, full: true, placeholder: "e.g. Self-serve leave balance on mobile" },
            { name: "category", label: "Category", type: "select", options: IDEA_CATEGORIES, required: true },
            { name: "impact", label: "Expected impact", type: "select", options: ["High", "Medium", "Low"], required: true },
            { name: "detail", label: "Describe the idea", type: "textarea", required: true, placeholder: "What problem does it solve, and how?" },
          ],
        },
      },
    ],
    table: {
      title: "Ideas",
      description: "Click an idea to see details; the panel approves or rejects ideas under review.",
      tabsOn: "status",
      filters: [{ key: "category", label: "Category" }],
      columns: [
        { key: "employee", label: "Shared by", type: "person" },
        { key: "title", label: "Idea" },
        { key: "category", label: "Category", minor: true },
        { key: "votes", label: "Votes", type: "number", align: "right" },
        { key: "date", label: "Shared on", type: "date", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      details: [
        { key: "impact", label: "Expected impact" },
        { key: "detail", label: "Idea" },
      ],
      rows: [
        ["Self-serve leave balance on mobile", "Product", 142, "Under Review", "High"],
        ["Shared calendar for meeting rooms", "Workplace", 118, "Approved", "Medium"],
        ["Monthly demo day for all teams", "Culture", 97, "Implemented", "Medium"],
        ["Auto-reminders for pending approvals", "Process", 88, "Under Review", "High"],
        ["Switch to annual software licences", "Cost saving", 64, "Submitted", "High"],
        ["Customer feedback wall in the office", "Customer", 51, "Submitted", "Low"],
        ["Quiet zone on every floor", "Workplace", 47, "Rejected", "Low"],
        ["Buddy programme for new joiners", "Culture", 76, "Implemented", "Medium"],
        ["One-click expense claims from receipts", "Process", 103, "Under Review", "High"],
        ["Plant-based options in the cafeteria", "Workplace", 39, "Submitted", "Low"],
      ].map(([title, category, votes, status, impact], i) => ({
        id: `IDEA-${101 + i}`,
        employee: i === 0 ? PEOPLE[0] : cycle(PEOPLE, i * 2 + 1),
        title, category, votes, status, impact,
        date: cycle(["03 Nov 2026", "08 Nov 2026", "12 Oct 2026", "15 Nov 2026", "19 Nov 2026", "21 Nov 2026", "28 Oct 2026", "05 Sep 2026", "17 Nov 2026", "23 Nov 2026"], i),
        detail: `${title}: shared to make day-to-day work simpler for everyone.`,
      })),
    },
  },

  "brand-kit": {
    eyebrow: "Brand Kit",
    title: "Brand Kit",
    description: "Approved logos, colours, fonts and templates in one place, so every deck, post and document looks like TapMind.",
    employee: { title: "Brand Kit", description: "Download approved logos, templates and guidelines. Ask the brand team if you need something new.", scope: "all" },
    approvals: true,
    stats: [
      { label: "Brand assets", value: "48", hint: "logos, templates, icons", icon: Palette },
      { label: "Downloads (Nov)", value: "612", delta: "+22%", trend: "up", icon: Download },
      { label: "Templates", value: "14", hint: "decks, docs, social", icon: FileImage },
      { label: "Open requests", value: "3", hint: "new asset requests", icon: Send },
    ],
    actions: [
      { label: "Download full kit", icon: Download, toast: "Brand kit (.zip) download started" },
      {
        label: "Upload asset",
        icon: Upload,
        role: "admin",
        form: {
          title: "Upload brand asset",
          submitLabel: "Publish",
          status: "Published",
          success: "Asset published to the brand kit",
          fields: [
            { name: "name", label: "Asset name", type: "text", required: true, full: true },
            { name: "type", label: "Type", type: "select", options: ["Logo", "Colour palette", "Font", "Template", "Icon set", "Guideline"], required: true },
            { name: "format", label: "Format", type: "select", options: ["SVG", "PNG", "PDF", "PPTX", "DOCX", "Figma", "ZIP"], required: true },
            { name: "file", label: "File", type: "file", hint: "SVG, PNG, PDF, PPTX or ZIP up to 50 MB" },
          ],
        },
      },
      {
        label: "Request an asset",
        icon: Send,
        role: "employee",
        form: {
          title: "Request a brand asset",
          description: "Tell the brand team what you need and by when.",
          submitLabel: "Send request",
          status: "Requested",
          success: "Request sent to the brand team",
          fields: [
            { name: "name", label: "What do you need?", type: "text", required: true, full: true, placeholder: "e.g. Event banner 3x6 ft" },
            { name: "type", label: "Type", type: "select", options: ["Logo", "Template", "Icon set", "Banner / print", "Social post"], required: true },
            { name: "format", label: "Format", type: "select", options: ["SVG", "PNG", "PDF", "PPTX"], required: true },
          ],
        },
      },
    ],
    aside: {
      title: "Brand colours",
      items: [
        { label: "TapMind Orange", value: "#FF6A1F", hint: "Primary: buttons, highlights", tone: "brand", pct: 100 },
        { label: "Ink Black", value: "#0B0B0B", hint: "Text, dark surfaces" },
        { label: "Signal Orange", value: "#FE5500", hint: "Logo gradient start" },
        { label: "Font", value: "Poppins", hint: "All weights 400–900" },
      ],
    },
    table: {
      title: "Assets",
      tabsOn: "type",
      columns: [
        { key: "name", label: "Asset" },
        { key: "type", label: "Type" },
        { key: "format", label: "Format", minor: true },
        { key: "owner", label: "Owner", type: "person", minor: true },
        { key: "updated", label: "Updated", type: "date", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [
        ["People Hub logo (on dark)", "Logo", "SVG", "Published"],
        ["TapMind logo (full colour)", "Logo", "SVG", "Published"],
        ["TapMind icon", "Logo", "PNG", "Published"],
        ["Brand colour palette", "Colour palette", "PDF", "Published"],
        ["Poppins font family", "Font", "ZIP", "Published"],
        ["Company deck template", "Template", "PPTX", "Published"],
        ["Letterhead", "Template", "DOCX", "Published"],
        ["Social post templates", "Template", "Figma", "Published"],
        ["Product icon set", "Icon set", "SVG", "Published"],
        ["Brand guidelines 2026", "Guideline", "PDF", "Published"],
        ["Event banner 3x6 ft", "Template", "PDF", "Requested"],
      ].map(([name, type, format, status], i) => ({
        id: `BRD-${201 + i}`,
        name, type, format, status,
        owner: cycle([PEOPLE[7], PEOPLE[3], PEOPLE[19]], i),
        updated: cycle(["18 Nov 2026", "02 Oct 2026", "02 Oct 2026", "14 Aug 2026", "14 Aug 2026", "05 Nov 2026", "21 Sep 2026", "11 Nov 2026", "30 Oct 2026", "01 Apr 2026", "24 Nov 2026"], i),
      })),
    },
  },
};
