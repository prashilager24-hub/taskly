// // import { useState, useEffect, useRef, useCallback } from "react";
// // import { Tabs, Tab, Input, Select, SelectItem, MenuItem } from "@/components/ui";
// // import axios from "axios";
// // import { DateRangePicker } from "@/components/ui";
// // import { parseDate } from "@internationalized/date";
// // // ─── CSS — only pseudo-elements & HeroUI slot overrides (can't do in Tailwind) ─
// // const GLOBAL_STYLE = `
// //   /* Noise texture pseudo — needs ::before, can't do in Tailwind */
// //   .wp-root::before {
// //     content:'';position:absolute;inset:0;pointer-events:none;z-index:999;
// //     background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
// //     opacity:.4;
// //   }
// //   /* Bar tooltip — needs ::after with attr(), can't do in Tailwind */
// //   .wp-bar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
// //     background:#0b0b0b;color:#fff;font-size:10px;padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:10;}
// //   /* Section title rule — needs ::after, can't do in Tailwind */
// //   .wp-section-title::after{content:'';flex:1;height:1px;background:#e4e4e7;}
// //   /* KPI bottom accent bar — needs ::after with CSS var, can't do in Tailwind */
// //   .wp-kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--kpi-color,#ff6a1f);}
// //   /* Textarea resize */
// //   .wp-textarea{resize:vertical;min-height:72px;line-height:1.5;width:100%;border:1.5px solid #d4d4d8;border-radius:8px;padding:10px 14px;font-size:14px;color:#0b0b0b;outline:none;transition:.15s;}
// //   .wp-textarea:focus{border-color:#ff6a1f;background:#fff;box-shadow:0 0 0 3px rgba(232,83,10,.1);}
// //   /* ── HeroUI Tabs overrides ── */
// //   .wp-tabs [data-slot="tabList"]{background:transparent!important;padding:0!important;gap:4px!important;border-radius:0!important;}
// //   .wp-tabs [data-slot="tab"]{padding:7px 18px!important;border-radius:6px!important;font-size:13px!important;font-weight:600!important;color:#8a8a8a!important;background:transparent!important;transition:background .15s,color .15s!important;height:auto!important;min-height:0!important;}
// //   .wp-tabs [data-slot="tab"]:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;}
// //   .wp-tabs [aria-selected="true"][data-slot="tab"],.wp-tabs [data-selected="true"][data-slot="tab"]{background:#ff6a1f!important;color:#fff!important;}
// //   .wp-tabs [data-slot="tabContent"]{font-size:13px!important;font-weight:600!important;}
// //   .wp-tabs [data-slot="cursor"]{display:none!important;}
// //   .wp-tabs [data-slot="panel"]{padding:0!important;outline:none!important;}
// // `;

// // // ─── CONSTANTS ─────────────────────────────────────────────────────────────────
// // const PRODUCTS = ['TapMind SDK', 'Display Ad Server', 'Video Ad Server', 'Hads Server', 'Proxy Server', 'AdCache', 'Mediation Adapter', 'Publisher Dashboard', 'Internal Tools', 'Other'];
// // const MODULES = ['Android SDK', 'iOS SDK', 'Web SDK', 'Ad Refresh', 'Mediation', 'oRTB / Demand', 'GAM / AdMob', 'Unity LevelPlay', 'MAX (AppLovin)', 'Backend API', 'Pipeline / Kafka', 'Aerospike', 'ClickHouse', 'DevOps / Infra', 'Docs / QA', 'Other'];

// // // ─── HELPERS ───────────────────────────────────────────────────────────────────
// // function getWeekNum(d) {
// //     const s = new Date(d.getFullYear(), 0, 1);
// //     return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
// // }
// // function calcMetrics(committed, completed, days, bugs, selfRating) {
// //     committed = parseFloat(committed) || 0;
// //     completed = parseFloat(completed) || 0;
// //     days = parseFloat(days) || 0;
// //     bugs = parseFloat(bugs) || 0;
// //     selfRating = parseFloat(selfRating) || 0;
// //     const completion = committed > 0 ? Math.round((completed / committed) * 100) : 0;
// //     const utilisation = Math.round((days / 5) * 100);
// //     const qualityScore = Math.max(0, Math.min(100, 100 - bugs * 15));
// //     const efficiency = Math.round(completion * 0.4 + utilisation * 0.35 + qualityScore * 0.25);
// //     const overall = Math.round(efficiency * 0.6 + (selfRating * 10) * 0.4);
// //     return { completion, utilisation, qualityScore, efficiency, overall };
// // }
// // function metricColor(v) {
// //     return v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
// // }
// // function trendIcon(v) { return v >= 85 ? '▲' : v >= 65 ? '●' : '▼'; }

// // // ─── RADAR SVG ─────────────────────────────────────────────────────────────────
// // function buildRadar(values, labels, colors) {
// //     const cx = 100, cy = 100, r = 72, n = values.length;
// //     const a = i => (Math.PI * 2 * i / n) - Math.PI / 2;
// //     const pt = (i, rad) => [cx + rad * Math.cos(a(i)), cy + rad * Math.sin(a(i))];
// //     let h = '';
// //     [.25, .5, .75, 1].forEach(f => {
// //         const pts = Array.from({ length: n }, (_, i) => pt(i, r * f)).map(p => p.join(',')).join(' ');
// //         h += `<polygon points="${pts}" fill="none" stroke="#e4e4e7" stroke-width="1"/>`;
// //     });
// //     for (let i = 0; i < n; i++) { const [x, y] = pt(i, r); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e4e4e7" stroke-width="1"/>`; }
// //     const dpts = values.map((v, i) => pt(i, r * (v / 100))).map(p => p.join(',')).join(' ');
// //     h += `<polygon points="${dpts}" fill="rgba(37,99,235,.12)" stroke="#ff6a1f" stroke-width="2"/>`;
// //     values.forEach((v, i) => { const [x, y] = pt(i, r * (v / 100)); h += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[i]}" stroke="#fff" stroke-width="2"/>`; });
// //     for (let i = 0; i < n; i++) {
// //         const [x, y] = pt(i, r + 16);
// //         const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
// //         h += `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#8a8a8a" font-size="9"  font-weight="700">${labels[i].toUpperCase()}</text>`;
// //     }
// //     return h;
// // }

// // // ─── EMPTY STATE ───────────────────────────────────────────────────────────────
// // function EmptyState({ icon, title, sub, btnLabel, onBtn }) {
// //     return (
// //         <div className="text-center py-16 px-5 flex flex-col items-center gap-3.5">
// //             <div className="text-5xl opacity-30">{icon}</div>
// //             <div className="text-lg font-bold text-ink-500 dark:text-ink-400">{title}</div>
// //             <div className="text-sm text-ink-400">{sub}</div>
// //             <button onClick={onBtn} className="mt-1.5 px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-[9px] cursor-pointer border-none hover:bg-brand-700 transition-all">
// //                 {btnLabel}
// //             </button>
// //         </div>
// //     );
// // }

// // // ─── TASK ROW COMPONENT ────────────────────────────────────────────────────────
// // function TaskRowInput({ task, onChange, onRemove }) {
// //     const TASK_TYPES = ['Feature', 'Bug', 'Refactor', 'Test', 'Docs', 'Review', 'Infra', 'Research'];
// //     const TASK_STATUSES = [{ key: 'done', label: 'Done' }, { key: 'partial', label: 'Partial' }, { key: 'missed', label: 'Missed' }, { key: 'carry', label: 'Carry' }];
// //     return (
// //         <div style={{ display: 'grid', gridTemplateColumns: '90px 2fr 80px 1fr 1fr 1.5fr 36px', gap: 10, alignItems: 'center' }} className=" border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5 transition-all">
// //             <Input size="sm" placeholder="TP-50" label="Jira ID" labelPlacement="outside"
// //                 value={task.jiraId || ''} onValueChange={v => onChange('jiraId', v.toUpperCase())}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <Input size="sm" placeholder="e.g. Fix AdMob adapter crash" label="Task Name" labelPlacement="outside"
// //                 value={task.name || ''} onValueChange={v => onChange('name', v)}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <Input size="sm" type="number" placeholder="3" label="SP" labelPlacement="outside"
// //                 value={task.sp || ''} onValueChange={v => onChange('sp', v)}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <Select size="sm" label="Product" labelPlacement="outside"
// //                 selectedKeys={[task.product || PRODUCTS[0]]} onSelectionChange={keys => onChange('product', Array.from(keys)[0])}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
// //                 {PRODUCTS.map(p => <SelectItem key={p}>{p}</SelectItem>)}
// //             </Select>
// //             <Select size="sm" label="Module" labelPlacement="outside"
// //                 selectedKeys={[task.module || MODULES[0]]} onSelectionChange={keys => onChange('module', Array.from(keys)[0])}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
// //                 {MODULES.map(m => <SelectItem key={m}>{m}</SelectItem>)}
// //             </Select>
// //             <div className="flex flex-col gap-1">
// //                 <div className="text-[10px] font-bold tracking-wide uppercase text-ink-400">Type &amp; Status</div>
// //                 <div style={{ display: 'flex', gap: 4 }}>
// //                     <Select size="sm" aria-label="Type"
// //                         selectedKeys={[task.type || 'Feature']} onSelectionChange={keys => onChange('type', Array.from(keys)[0])}
// //                         style={{ flex: 1 }}>
// //                         {TASK_TYPES.map(t => <SelectItem key={t}>{t}</SelectItem>)}
// //                     </Select>
// //                     <Select size="sm" aria-label="Status"
// //                         selectedKeys={[task.status || 'done']} onSelectionChange={keys => onChange('status', Array.from(keys)[0])}
// //                         style={{ flex: 1 }}>
// //                         {TASK_STATUSES.map(s => <SelectItem key={s.key}>{s.label}</SelectItem>)}
// //                     </Select>
// //                 </div>
// //             </div>
// //             <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">
// //                 ×
// //             </button>
// //         </div>
// //     );
// // }

// // // ─── GOAL ROW COMPONENT ────────────────────────────────────────────────────────
// // function GoalRowInput({ goal, onChange, onRemove }) {
// //     return (
// //         <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 36px', gap: 10, alignItems: 'center' }} className=" border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5">
// //             <Input size="sm" placeholder="e.g. Zero crashes in prod" label="Goal Description" labelPlacement="outside"
// //                 value={goal.name || ''} onValueChange={v => onChange('name', v)}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <Input size="sm" type="number" placeholder="100" label="Target %" labelPlacement="outside"
// //                 value={goal.target || ''} onValueChange={v => onChange('target', v)}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <Input size="sm" type="number" placeholder="85" label="Achieved %" labelPlacement="outside"
// //                 value={goal.achieved || ''} onValueChange={v => onChange('achieved', v)}
// //                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
// //             <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">
// //                 ×
// //             </button>
// //         </div>
// //     );
// // }

// // // ─── FORM FIELD ────────────────────────────────────────────────────────────────
// // function FormGroup({ label, hint, children, full, half }) {
// //     return (
// //         <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1/-1' : half ? 'span 2' : undefined }}>
// //             <label className="text-[11px] font-bold tracking-[1.2px] uppercase text-ink-500 dark:text-ink-400">
// //                 {label}{hint && <span className="text-[10px] font-normal text-ink-400 tracking-normal ml-1.5 normal-case">{hint}</span>}
// //             </label>
// //             {children}
// //         </div>
// //     );
// // }

// // // ─── FORM TAB ──────────────────────────────────────────────────────────────────
// // function FormTab({ onSubmit, onSwitchDashboard }) {
// //     const now = new Date();
// //     const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
// //     const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
// //     const fmt = d => d.toISOString().slice(0, 10);

// //     const [f, setF] = useState({
// //         name: '', role: '', sprint: `W-${getWeekNum(now)}`, weekStart: fmt(weekStart), weekEnd: fmt(weekEnd),
// //         days: '', committed: '', completed: '', bugs: '', reviews: '', carryover: '', blockers: '', selfRating: '',
// //         achievements: '', challenges: '', nextFocus: ''
// //     });
// //     const [tasks, setTasks] = useState([
// //     ]);
// //     const [goals, setGoals] = useState([

// //     ]);
// //     const taskId = useRef(3);
// //     const goalId = useRef(3);

// //     const live = (f.committed || f.completed) ? calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating) : null;
// //     const lc = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
// //     const ll = v => v >= 85 ? '▲ On Target' : v >= 65 ? '● Moderate' : '▼ Below';

// //     function addTask() { const id = taskId.current++; setTasks(t => [...t, { id, jiraId: '', name: '', sp: '', product: PRODUCTS[0], module: MODULES[0], type: 'Feature', status: 'done' }]); }
// //     function removeTask(id) { setTasks(t => t.filter(x => x.id !== id)); }
// //     function updateTask(id, key, val) { setTasks(t => t.map(x => x.id === id ? { ...x, [key]: val } : x)); }
// //     function addGoal() { const id = goalId.current++; setGoals(g => [...g, { id, name: '', target: '', achieved: '' }]); }
// //     function removeGoal(id) { setGoals(g => g.filter(x => x.id !== id)); }
// //     function updateGoal(id, key, val) { setGoals(g => g.map(x => x.id === id ? { ...x, [key]: val } : x)); }

// //     function handleSubmit() {
// //         if (!f.name.trim()) { showToastGlobal('⚠️ Please enter your name!', '#ff6a1f'); return; }
// //         if (!f.sprint.trim()) { showToastGlobal('⚠️ Please enter the sprint/week label!', '#ff6a1f'); return; }
// //         const metrics = calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating);
// //         const entry = {
// //             id: Date.now(), ...f,
// //             committed: parseFloat(f.committed) || 0, completed: parseFloat(f.completed) || 0,
// //             days: parseFloat(f.days) || 5, bugs: parseFloat(f.bugs) || 0, reviews: parseFloat(f.reviews) || 0,
// //             carryover: parseFloat(f.carryover) || 0, blockers: parseFloat(f.blockers) || 0, selfRating: parseFloat(f.selfRating) || 0,
// //             metrics,
// //             tasks: tasks.filter(t => t.name).map(t => ({ ...t, sp: parseFloat(t.sp) || 0 })),
// //             goals: goals.filter(g => g.name).map(g => ({ ...g, target: parseFloat(g.target) || 100, achieved: parseFloat(g.achieved) || 0 })),
// //             timestamp: new Date().toISOString(), managerNote: '',
// //         };
// //         onSubmit(entry);
// //     }

// //     function handleReset() {
// //         setF({ name: '', role: '', sprint: `W-${getWeekNum(now)}`, weekStart: fmt(weekStart), weekEnd: fmt(weekEnd), days: '', committed: '', completed: '', bugs: '', reviews: '', carryover: '', blockers: '', selfRating: '', achievements: '', challenges: '', nextFocus: '' });
// //         setTasks([{ id: taskId.current++, jiraId: '', name: '', sp: '', product: PRODUCTS[0], module: MODULES[0], type: 'Feature', status: 'done' }, { id: taskId.current++, jiraId: '', name: '', sp: '', product: PRODUCTS[0], module: MODULES[0], type: 'Feature', status: 'done' }]);
// //         setGoals([{ id: goalId.current++, name: '', target: '', achieved: '' }, { id: goalId.current++, name: '', target: '', achieved: '' }]);
// //     }

// //     const inp = (id, extra = {}) => ({ value: f[id], onChange: e => setF(p => ({ ...p, [id]: e.target.value })), ...extra });

// //     return (
// //         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
// //             <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', overflow: 'hidden', marginBottom: 28 }}>
// //                 {/* Header */}
// //                 <div style={{ padding: '24px 30px', display: 'flex', alignItems: 'center', gap: 16 }}>
// //                     <div>
// //                         <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Weekly Sprint Entry</h2>
// //                         <p style={{ fontSize: 13, color: '#8a8a8a' }}>Fill in your sprint details — all metrics are calculated automatically</p>
// //                     </div>
// //                 </div>
// //                 <div style={{ padding: '28px 30px' }}>
// //                     {/* Identity */}
// //                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Developer Identity</div>
// //                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
// //                         <FormGroup label="Full Name"><Input variant="bordered" size="sm" placeholder="e.g. name" {...inp('name')} onValueChange={v => setF(p => ({ ...p, name: v }))} /></FormGroup>
// //                         <FormGroup label="Role / Team"><Input variant="bordered" size="sm" placeholder="e.g. Engineer" {...inp('role')} onValueChange={v => setF(p => ({ ...p, role: v }))} /></FormGroup>
// //                         <FormGroup label="Sprint / Week Label"><Input variant="bordered" size="sm" placeholder="e.g. W-24 / Sprint 20" {...inp('sprint')} onValueChange={v => setF(p => ({ ...p, sprint: v }))} /></FormGroup>
// //                         {/* <FormGroup label="Week Start Date"><Input variant="bordered" size="sm" placeholder="e.g. 2025-06-02" {...inp('weekStart')} onValueChange={v => setF(p => ({ ...p, weekStart: v }))} /></FormGroup>
// //                         <FormGroup label="Week End Date"><Input variant="bordered" size="sm" placeholder="e.g. 2025-06-06" {...inp('weekEnd')} onValueChange={v => setF(p => ({ ...p, weekEnd: v }))} /></FormGroup> */}
// //                         <FormGroup label="Week Range">
// //                             <DateRangePicker
// //                                 variant="bordered"
// //                                 size="sm"
// //                                 value={
// //                                     f.weekStart && f.weekEnd
// //                                         ? {
// //                                             start: parseDate(f.weekStart),
// //                                             end: parseDate(f.weekEnd),
// //                                         }
// //                                         : null
// //                                 }
// //                                 onChange={(range) => {
// //                                     setF((p) => ({
// //                                         ...p,
// //                                         weekStart: range?.start?.toString() || "",
// //                                         weekEnd: range?.end?.toString() || "",
// //                                     }));
// //                                 }}
// //                             />
// //                         </FormGroup>
// //                         <FormGroup label="Days Present" hint="(out of 5)"><Input variant="bordered" size="sm" type="number" placeholder="5" {...inp('days')} onValueChange={v => setF(p => ({ ...p, days: v }))} /></FormGroup>
// //                     </div>

// //                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

// //                     {/* Story Points */}
// //                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Story Points</div>
// //                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
// //                         <FormGroup label="Story Points Committed"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 20" {...inp('committed')} onValueChange={v => setF(p => ({ ...p, committed: v }))} /></FormGroup>
// //                         <FormGroup label="Story Points Completed"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 17" {...inp('completed')} onValueChange={v => setF(p => ({ ...p, completed: v }))} /></FormGroup>
// //                         <FormGroup label="Bugs Introduced"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 2" {...inp('bugs')} onValueChange={v => setF(p => ({ ...p, bugs: v }))} /></FormGroup>
// //                         <FormGroup label="PRs / Code Reviews Done"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 4" {...inp('reviews')} onValueChange={v => setF(p => ({ ...p, reviews: v }))} /></FormGroup>
// //                         <FormGroup label="Carry-over SP from last week"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 3" {...inp('carryover')} onValueChange={v => setF(p => ({ ...p, carryover: v }))} /></FormGroup>
// //                         <FormGroup label="Blockers Encountered"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 1" {...inp('blockers')} onValueChange={v => setF(p => ({ ...p, blockers: v }))} /></FormGroup>
// //                     </div>

// //                     {/* Live Preview */}
// //                     {live && (
// //                         <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
// //                             <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 12 }}>⚡ Live Auto-Calculation</div>
// //                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
// //                                 {[
// //                                     { k: 'Completion Rate', v: live.completion + '%', c: lc(live.completion), l: ll(live.completion) },
// //                                     { k: 'Utilisation', v: live.utilisation + '%', c: lc(live.utilisation), l: ll(live.utilisation) },
// //                                     { k: 'Quality Score', v: live.qualityScore + '/100', c: lc(live.qualityScore), l: ll(live.qualityScore) },
// //                                     { k: 'Efficiency Score', v: live.efficiency + '/100', c: lc(live.efficiency), l: ll(live.efficiency) },
// //                                 ].map(m => (
// //                                     <div key={m.k} style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, padding: '12px 14px' }}>
// //                                         <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>{m.k}</div>
// //                                         <div style={{ fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
// //                                         <div style={{ fontSize: 11, color: m.c, marginTop: 4, fontWeight: 600 }}>{m.l}</div>
// //                                     </div>
// //                                 ))}
// //                             </div>
// //                         </div>
// //                     )}

// //                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

// //                     {/* Tasks */}
// //                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Tasks Worked This Week</div>
// //                     <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
// //                         {tasks.map(t => (
// //                             <TaskRowInput key={t.id} task={t} onChange={(k, v) => updateTask(t.id, k, v)} onRemove={() => removeTask(t.id)} />
// //                         ))}
// //                     </div>
// //                     <AddBtn onClick={addTask}>＋ Add Task</AddBtn>

// //                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

// //                     {/* Goals */}
// //                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Weekly Goals <span style={{ fontSize: 10, color: '#8a8a8a', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>Set targets and track what you achieved</span></div>
// //                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
// //                         {goals.map(g => (
// //                             <GoalRowInput key={g.id} goal={g} onChange={(k, v) => updateGoal(g.id, k, v)} onRemove={() => removeGoal(g.id)} />
// //                         ))}
// //                     </div>
// //                     <AddBtn onClick={addGoal}>＋ Add Goal</AddBtn>

// //                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

// //                     {/* Reflection */}
// //                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Self Reflection</div>
// //                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
// //                         <FormGroup label="Key Achievements This Week" full>
// //                             <textarea className="wp-textarea" placeholder="What did you accomplish? What are you proud of?" {...inp('achievements')} />
// //                         </FormGroup>
// //                         <FormGroup label="Blockers / Challenges" full>
// //                             <textarea className="wp-textarea" placeholder="What slowed you down? What do you need help with?" {...inp('challenges')} />
// //                         </FormGroup>
// //                         <FormGroup label="Focus Area Next Week" half>
// //                             <textarea className="wp-textarea" placeholder="What is your top priority next sprint?" style={{ minHeight: 54 }} {...inp('nextFocus')} />
// //                         </FormGroup>
// //                         <FormGroup label="confidence score" hint="(1–10)">
// //                             <Input variant="bordered" size="sm" type="number" placeholder="7" {...inp('selfRating')} onValueChange={v => setF(p => ({ ...p, selfRating: v }))} />
// //                         </FormGroup>
// //                     </div>

// //                     {/* Submit Row */}
// //                     <div className="flex items-center gap-3.5 mt-6">
// //                         <button onClick={handleSubmit} className="flex items-center gap-2.5 px-8 py-3 bg-brand-600 text-white text-[15px] font-bold rounded-[10px] cursor-pointer transition-all hover:bg-brand-700 border-none">
// //                             <span>Submit Sprint Entry</span><span>→</span>
// //                         </button>
// //                         <button onClick={handleReset} className="px-5 py-3 bg-transparent border-[1.5px] border-ink-300 dark:border-white/15 rounded-[10px] text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer transition-all">
// //                             Reset
// //                         </button>
// //                         <span className="text-xs text-ink-400 ml-auto">All fields with auto-calc will update your dashboard instantly</span>
// //                     </div>
// //                 </div>
// //             </div>
// //         </div>
// //     );
// // }

// // function AddBtn({ onClick, children }) {
// //     return (
// //         <button onClick={onClick}
// //             className="mt-2.5 px-4 py-2 bg-transparent border-[1.5px] border-dashed border-ink-300 dark:border-white/15 rounded-lg text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer flex items-center gap-2 transition-all hover:border-brand-600 hover:text-brand-600 hover:bg-[rgba(232,83,10,.04)]">
// //             {children}
// //         </button>
// //     );
// // }

// // // ─── DASHBOARD TAB ─────────────────────────────────────────────────────────────
// // function mapApiItem(item) {
// //     return {
// //         id: item.id,
// //         name: item.userName,
// //         role: item.userEmail || '',
// //         sprint: item.sprintLabel,
// //         weekStart: item.weekStart,
// //         weekEnd: item.weekEnd,
// //         days: item.daysPresent,
// //         committed: item.spCommitted,
// //         completed: item.spCompleted,
// //         bugs: item.bugsIntroduced,
// //         reviews: item.prReviews,
// //         carryover: item.spCarryover,
// //         blockers: item.blockers,
// //         selfRating: item.selfRating,
// //         achievements: item.achievements || '',
// //         challenges: item.challenges || '',
// //         nextFocus: item.nextFocus || '',
// //         managerNote: item.managerNote || '',
// //         timestamp: item.entryTimestamp,
// //         metrics: {
// //             completion: item.scoreCompletion,
// //             utilisation: item.scoreUtilisation,
// //             qualityScore: item.scoreQuality,
// //             efficiency: item.scoreEfficiency,
// //             overall: item.scoreOverall,
// //         },
// //         // API already gives radar — use it directly
// //         radarFromApi: item.radar,
// //         tasks: (item.tasks || []).map(t => ({
// //             id: t.id,
// //             jiraId: t.jiraId,
// //             name: t.taskName,           // ← taskName → name
// //             sp: t.storyPoints,          // ← storyPoints → sp
// //             product: t.product,
// //             module: t.module,
// //             type: t.taskType,
// //             status: t.status?.toLowerCase(), // API sends "DONE" → need "done"
// //         })),
// //         goals: (item.goals || []).map(g => ({
// //             name: g.goalName,
// //             target: g.targetPct,
// //             achieved: g.achievedPct,
// //         })),
// //     };
// // }

// // // ─── DASHBOARD TAB ─────────────────────────────────────────────────────────────
// // function DashboardTab({ entries, onSwitchForm }) {
// //     const [dashDev, setDashDev] = useState(null);
// //     const [weekFilter, setWeekFilter] = useState('all');
// //     const [managerNote, setManagerNote] = useState('');
// //     const [newData, setNewData] = useState([]); // raw mapped entries from API
// //     const [loading, setLoading] = useState(true);

// //     const now = new Date();
// //     const weekStart = new Date(now);
// //     weekStart.setDate(now.getDate() - now.getDay() + 1);
// //     const weekEnd = new Date(weekStart);
// //     weekEnd.setDate(weekStart.getDate() + 4);

// //     // ── Derive display data ──────────────────────────────────────────────────
// //     const displayEntries = newData.length ? newData : entries; // fallback to prop
// //     const names = [...new Set(displayEntries.map(e => e.name))];
// //     const sprints = [...new Set(displayEntries.map(e => e.sprint))].sort();
// //     const selectedDev = dashDev || (displayEntries.length ? displayEntries[displayEntries.length - 1].name : null);
// //     const devEntries = displayEntries
// //         .filter(e => e.name === selectedDev)
// //         .sort((a, b) => a.sprint.localeCompare(b.sprint));
// //     const cur = weekFilter === 'all'
// //         ? devEntries[devEntries.length - 1]
// //         : (devEntries.find(e => e.sprint === weekFilter) || devEntries[devEntries.length - 1]);

// //     // ── ALL hooks before any conditional return ──────────────────────────────
// //     useEffect(() => {
// //         const fetchEntries = async () => {
// //             const userStr = localStorage.getItem('authUserLD');
// //             const user = userStr ? JSON.parse(userStr) : null;
// //             try {
// //                 const result = await axios.get(
// //                     `t2.0/authentificationUtilization/getSprintEntry?userId=${user?.userID}&from=${weekStart.toISOString().slice(0, 10)}&to=${weekEnd.toISOString().slice(0, 10)}`
// //                 );
// //                 const mapped = result.data.data.content.map(mapApiItem);
// //                 setNewData(mapped);
// //             } catch (e) {
// //                 console.error('Error fetching entries:', e);
// //             } finally {
// //                 setLoading(false);
// //             }
// //         };
// //         fetchEntries();
// //     }, []);

// //     useEffect(() => {
// //         setManagerNote(cur?.managerNote || '');
// //     }, [cur?.id]);

// //     // ── Conditional returns AFTER all hooks ──────────────────────────────────
// //     if (loading) return (
// //         <div style={{ margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: 14 }}>
// //             Loading dashboard...
// //         </div>
// //     );

// //     if (!displayEntries.length) return (
// //         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
// //             <DateRangePicker
// //                 variant="bordered"
// //                 size="sm"
// //                 value={
// //                     weekStart && weekEnd
// //                         ? {
// //                             start: parseDate(weekStart.toISOString().slice(0, 10)),
// //                             end: parseDate(weekEnd.toISOString().slice(0, 10)),
// //                         }
// //                         : null
// //                 }
// //                 onChange={(range) => {
// //                     setF((p) => ({
// //                         ...p,
// //                         weekStart: range?.start?.toString() || "",
// //                         weekEnd: range?.end?.toString() || "",
// //                     }));
// //                 }}
// //             />
// //             <EmptyState
// //                 title="No sprint data yet"
// //                 sub="Submit your first weekly sprint entry to see your dashboard"
// //                 btnLabel="Go to Sprint Entry →"
// //                 onBtn={onSwitchForm}
// //             />
// //         </div>
// //     );

// //     if (!cur) return null;

// //     const m = cur.metrics;
// //     const goalsMet = cur.goals.filter(g => g.achieved >= g.target).length;
// //     const tasksTotal = cur.tasks.length;
// //     const tasksDone = cur.tasks.filter(t => t.status === 'done').length;
// //     const maxSP = Math.max(...devEntries.map(e => Math.max(e.committed, e.completed, 1)));

// //     // Use radar values from API if available, else compute
// //     const radar = cur.radarFromApi;
// //     const radarVals = radar
// //         ? [radar.utilisation, radar.velocity, radar.reviews, radar.quality,
// //         radar.goals, radar.self]
// //         : [m.utilisation, m.completion, Math.min(100, cur.reviews * 20), m.qualityScore,
// //         goalsMet > 0 ? Math.round((goalsMet / Math.max(cur.goals.length, 1)) * 100) : 0,
// //         Math.min(100, cur.selfRating * 10)];

// //     const radarLabels = ['Util', 'Velocity', 'Reviews', 'Quality', 'Goals', 'Self'];
// //     const radarColors = ['#ff6a1f', '#ff6a1f', '#059669', '#ff6a1f', '#d97706', '#0891b2'];
// //     const score = m.overall || m.efficiency;
// //     const scoreColor = metricColor(score);
// //     const scoreLabel = score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : 'NEEDS FOCUS';
// //     const circumference = 2 * Math.PI * 36;
// //     const dashOffset = circumference * (1 - score / 100);

// //     const statusTag = { done: { lbl: '✓ Done' }, partial: { lbl: '◑ Partial' }, missed: { lbl: '✗ Missed' }, carry: { lbl: '→ Carry' } };
// //     const tagStyle = {
// //         done: { background: 'rgba(22,163,74,.1)', color: '#059669' },
// //         partial: { background: 'rgba(202,138,4,.1)', color: '#d97706' },
// //         missed: { background: 'rgba(220,38,38,.1)', color: '#ff4b2b' },
// //         carry: { background: 'rgba(107,114,128,.1)', color: '#6b7280' }
// //     };

// //     return (
// //         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
// //             {/* Header */}

// //             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
// //                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
// //                     <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 30, padding: '8px 18px 8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)' }}>
// //                         <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ff6a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
// //                             {selectedDev.split(' ').map(w => w[0]).join('').slice(0, 2)}
// //                         </div>
// //                         <div>
// //                             <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDev}</div>
// //                             <div style={{ fontSize: 11, color: '#8a8a8a' }}>{cur.role || 'Developer'}</div>
// //                         </div>
// //                     </div>
// //                     <DateRangePicker
// //                         variant="bordered"
// //                         size="sm"
// //                         value={
// //                             weekStart && weekEnd
// //                                 ? {
// //                                     start: parseDate(weekStart.toISOString().slice(0, 10)),
// //                                     end: parseDate(weekEnd.toISOString().slice(0, 10)),
// //                                 }
// //                                 : null
// //                         }
// //                         onChange={(range) => {
// //                             setF((p) => ({
// //                                 ...p,
// //                                 weekStart: range?.start?.toString() || "",
// //                                 weekEnd: range?.end?.toString() || "",
// //                             }));
// //                         }}
// //                     />
// //                     <Select size="sm" variant="bordered" aria-label="Select developer"
// //                         selectedKeys={[selectedDev]} onSelectionChange={keys => { setDashDev(String(Array.from(keys)[0])); setWeekFilter('all'); }}
// //                         style={{ minWidth: 160 }}>
// //                         {names.map(n => <SelectItem key={n}>{n}</SelectItem>)}
// //                     </Select>
// //                 </div>
// //                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
// //                     <div style={{ fontSize: 11, color: '#8a8a8a', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Filter by Week</div>
// //                     <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
// //                         {['all', ...sprints].map(s => (
// //                             <button key={s} onClick={() => setWeekFilter(s)}
// //                                 style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s', border: '1px solid', borderColor: weekFilter === s ? '#0b0b0b' : '#e4e4e7', background: weekFilter === s ? '#0b0b0b' : '#ffffff', color: weekFilter === s ? '#fff' : '#6a6a6a' }}>
// //                                 {s === 'all' ? 'Latest' : s}
// //                             </button>
// //                         ))}
// //                     </div>
// //                 </div>
// //             </div>

// //             {/* Section Title */}
// //             <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-3.5">Performance Overview · {cur.sprint} ({cur.weekStart} → {cur.weekEnd})</div>

// //             {/* KPIs */}
// //             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
// //                 {[
// //                     { label: 'Completion Rate', val: `${m.completion}%`, sub: `${cur.completed}/${cur.committed} SP`, c: metricColor(m.completion), badge: trendIcon(m.completion) + ' ' + (m.completion >= 85 ? 'On Target' : m.completion >= 65 ? 'Moderate' : 'Below') },
// //                     { label: 'Utilisation', val: `${m.utilisation}%`, sub: `${cur.days}/5 days logged`, c: metricColor(m.utilisation), badge: trendIcon(m.utilisation) + ' Capacity' },
// //                     { label: 'Quality Score', val: `${m.qualityScore}`, sub: `${cur.bugs} bug${cur.bugs !== 1 ? 's' : ''} introduced`, c: metricColor(m.qualityScore), badge: trendIcon(m.qualityScore) + ' ' + (m.qualityScore >= 85 ? 'Clean' : 'Review needed') },
// //                     { label: 'Efficiency Score', val: `${m.efficiency}`, sub: 'Composite /100', c: metricColor(m.efficiency), badge: trendIcon(m.efficiency) + ' Efficiency' },
// //                     { label: 'Goals Met', val: `${goalsMet}/${cur.goals.length}`, sub: `${tasksDone}/${tasksTotal} tasks done`, c: metricColor(goalsMet / Math.max(cur.goals.length, 1) * 100), badge: goalsMet === cur.goals.length && cur.goals.length > 0 ? 'All met' : goalsMet > 0 ? 'Partial' : 'Missed', badgeColor: 'rgba(22,163,74,.1)', badgeTextColor: '#059669' },
// //                 ].map((k, i) => (
// //                     <div key={i} className="wp-kpi relative overflow-hidden rounded-xl p-5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', '--kpi-color': k.c } as React.CSSProperties}>
// //                         <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 8 }}>{k.label}</div>
// //                         <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: k.c, marginBottom: 4 }}>{k.val}</div>
// //                         <div style={{ fontSize: 11, color: '#8a8a8a', fontFamily: 'monospace' }}>{k.sub}</div>
// //                         <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, marginTop: 8, background: k.badgeColor || `${k.c}22`, color: k.badgeTextColor || k.c }}>{k.badge}</div>
// //                     </div>
// //                 ))}
// //             </div>

// //             {/* Velocity + Goals */}
// //             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
// //                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
// //                         Sprint Velocity Trend <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{devEntries.length} weeks</span>
// //                     </div>
// //                     <div className="bar-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
// //                         {devEntries.map(e => {
// //                             const cH = Math.round((e.committed / maxSP) * 100);
// //                             const dH = Math.round((e.completed / maxSP) * 100);
// //                             const pct = e.committed > 0 ? Math.round((e.completed / e.committed) * 100) : 0;
// //                             return (
// //                                 <div key={e.sprint} className="flex-1 flex flex-col items-center gap-1">
// //                                     <div className="flex-1 flex items-end gap-[3px] w-full">
// //                                         <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-white/10 transition-[height] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)]" style={{ height: `${cH}%` }} data-tip={`Committed: ${e.committed}SP`} />
// //                                         <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative transition-[height] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)]" style={{ height: `${dH}%`, background: 'linear-gradient(180deg,#ff6a1f,#e85511)' }} data-tip={`Done: ${e.completed}SP (${pct}%)`} />
// //                                     </div>
// //                                     <div style={{ fontSize: 10, color: '#8a8a8a', fontFamily: 'monospace' }}>{e.sprint}</div>
// //                                 </div>
// //                             );
// //                         })}
// //                     </div>
// //                     <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
// //                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'inline-block' }} /> Committed</div>
// //                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#ff6a1f', display: 'inline-block' }} /> Completed</div>
// //                     </div>
// //                 </div>
// //                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
// //                         Goal Achievement <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{goalsMet}/{cur.goals.length} met</span>
// //                     </div>
// //                     {cur.goals.length ? cur.goals.map((g, i) => {
// //                         const pct = Math.min(100, Math.round((g.achieved / g.target) * 100));
// //                         const c = g.achieved >= g.target ? '#059669' : g.achieved >= g.target * .7 ? '#d97706' : '#ff4b2b';
// //                         return (
// //                             <div key={i} style={{ marginBottom: 14 }}>
// //                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
// //                                     <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
// //                                     <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: c }}>{g.achieved}%</div>
// //                                 </div>
// //                                 <div style={{ height: 7, background: '#f4f4f5', borderRadius: 20, overflow: 'hidden' }}>
// //                                     <div className="h-full rounded-[20px] transition-[width] duration-[600ms] ease-[cubic-bezier(.4,0,.2,1)]" style={{ width: `${pct}%`, background: c }} />
// //                                 </div>
// //                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
// //                                     <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#8a8a8a' }}>Target: {g.target}%</div>
// //                                     <div style={{ fontSize: 10, fontFamily: 'monospace', color: c }}>{g.achieved >= g.target ? '✓ Achieved' : '✗ Not met'}</div>
// //                                 </div>
// //                             </div>
// //                         );
// //                     }) : <div style={{ color: '#8a8a8a', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No goals set for this week</div>}
// //                 </div>
// //             </div>

// //             {/* Tasks + Radar + Score */}
// //             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
// //                 <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', gridColumn: 'span 2' }}>
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
// //                         Tasks This Week
// //                         {/* <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{tasksTotal} tasks · {cur.tasks.reduce((a, t) => a + t.sp, 0)} SP total</span> */}
// //                     </div>
// //                     <table className="tasks-tbl w-full border-collapse">
// //                         <thead><tr><th>Jira ID</th><th>Task</th><th>SP</th><th>Product</th><th>Module</th><th>Type</th><th>Status</th></tr></thead>
// //                         <tbody>
// //                             {cur.tasks.length ? cur.tasks.map((t, i) => (
// //                                 <tr key={i}>
// //                                     <td className="text-center">{t.jiraId ? <a href={`https://tapminds.atlassian.net/browse/${t.jiraId}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#ff6a1f', textDecoration: 'none', background: 'rgba(37,99,235,.08)', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{t.jiraId} ↗</a> : <span style={{ color: '#8a8a8a', fontSize: 11 }}>—</span>}</td>
// //                                     <td className="text-center" style={{ fontWeight: 500 }}>{t.name}</td>
// //                                     <td className="text-center" ><span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 6, color: '#ff6a1f' }}>{t.sp}</span></td>
// //                                     <td className="text-center" ><span style={{ fontSize: 11, color: '#6a6a6a', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{t.product || '—'}</span></td>
// //                                     <td className="text-center" ><span style={{ fontSize: 11, color: '#ff6a1f', background: 'rgba(124,58,237,.07)', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{t.module || '—'}</span></td>
// //                                     <td className="text-center" style={{ fontSize: 11, color: '#8a8a8a' }}>{t.type}</td>
// //                                     <td className="text-center" ><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...tagStyle[t.status] }}>{statusTag[t.status]?.lbl}</span></td>
// //                                 </tr>
// //                             )) : <tr><td colSpan="7" style={{ textAlign: 'center', color: '#8a8a8a', padding: 20 }}>No tasks logged</td></tr>}
// //                         </tbody>
// //                     </table>
// //                 </div>
// //                 {/* Radar + Score */}
// //                 <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column' }}>
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Performance Radar</div>
// //                     <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
// //                         <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: buildRadar(radarVals, radarLabels, radarColors) }} />
// //                     </div>
// //                     <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
// //                         {radarLabels.map((l, i) => (
// //                             <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
// //                                 <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8a8a8a' }}>
// //                                     <span style={{ width: 8, height: 8, borderRadius: 2, background: radarColors[i], display: 'inline-block' }} />
// //                                     {l}
// //                                 </span>
// //                                 <span style={{ fontFamily: 'monospace', fontSize: 11, color: radarColors[i], fontWeight: 600 }}>{radarVals[i]}</span>
// //                             </div>
// //                         ))}
// //                     </div>
// //                     <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
// //                         <svg width="88" height="88" viewBox="0 0 88 88">
// //                             <circle cx="44" cy="44" r="36" fill="none" stroke="#f4f4f5" strokeWidth="8" />
// //                             <circle cx="44" cy="44" r="36" fill="none" stroke={scoreColor} strokeWidth="8"
// //                                 strokeDasharray={circumference} strokeDashoffset={dashOffset}
// //                                 strokeLinecap="round" transform="rotate(-90 44 44)" style={{ transition: '.6s' }} />
// //                             <text x="44" y="50" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="18" fontWeight="900" fill={scoreColor}>{score}</text>
// //                         </svg>
// //                         <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: scoreColor }}>{scoreLabel}</div>
// //                     </div>
// //                 </div>
// //             </div>

// //             {/* Reflection + Manager Note */}
// //             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
// //                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Developer Reflection</div>
// //                     {cur.achievements && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#059669', marginBottom: 6 }}>✓ Achievements</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.achievements}</div></div>}
// //                     {cur.challenges && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff4b2b', marginBottom: 6 }}>⚠ Blockers</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.challenges}</div></div>}
// //                     {cur.nextFocus && <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff6a1f', marginBottom: 6 }}>→ Next Week Focus</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.nextFocus}</div></div>}
// //                     {!cur.achievements && !cur.challenges && !cur.nextFocus && <div style={{ textAlign: 'center', color: '#8a8a8a', padding: 20, fontSize: 13 }}>No reflection notes added</div>}
// //                 </div>
// //                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
// //                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Manager Review Note</div>
// //                     <textarea value={managerNote} onChange={e => setManagerNote(e.target.value)} placeholder="Add manager feedback, coaching notes, or observations for this sprint…" className="wp-textarea" style={{ minHeight: 64 }} />
// //                     <button onClick={() => { showToastGlobal('📝 Manager note saved!'); }} className="mt-2 px-4 py-2 bg-ink-900 text-white text-xs font-bold rounded-[7px] cursor-pointer border-none">Save Note</button>
// //                     <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e4e4e7' }}>
// //                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
// //                             {[
// //                                 { label: 'Reviews Done', val: cur.reviews, color: '#ff6a1f' },
// //                                 { label: 'Carry-over SP', val: cur.carryover, color: '#d97706' },
// //                                 { label: 'Blockers', val: cur.blockers, color: '#ff4b2b' },
// //                                 { label: 'Self Rating', val: `${cur.selfRating}/10`, color: '#ff6a1f' },
// //                             ].map(x => (
// //                                 <div key={x.label} style={{ borderRadius: 8, padding: 12 }} className="shadow-md">
// //                                     <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 4 }}>{x.label}</div>
// //                                     <div style={{ fontSize: 20, fontWeight: 800, color: x.color }}>{x.val}</div>
// //                                 </div>
// //                             ))}
// //                         </div>
// //                     </div>
// //                 </div>
// //             </div>
// //         </div>
// //     );
// // }

// // // ─── HISTORY TAB ───────────────────────────────────────────────────────────────
// // function HistoryTab({ entries, onDelete, onEdit, onSwitchForm }) {
// //     const [newData, setNewData] = useState([]); // raw mapped entries from API

// //     const now = new Date();
// //     const weekStart = new Date(now);
// //     weekStart.setDate(now.getDate() - now.getDay() + 1);
// //     const weekEnd = new Date(weekStart);
// //     weekEnd.setDate(weekStart.getDate() + 4);
// //     useEffect(() => {
// //         const fetchEntries = async () => {
// //             const userStr = localStorage.getItem('authUserLD');
// //             const user = userStr ? JSON.parse(userStr) : null;
// //             try {
// //                 const result = await axios.get(
// //                     `t2.0/authentificationUtilization/getSprintEntry?userId=${user?.userID}&from=${weekStart.toISOString().slice(0, 10)}&to=${weekEnd.toISOString().slice(0, 10)}`
// //                 );
// //                 const mapped = result.data.data.content.map(mapApiItem);
// //                 setNewData(mapped);
// //             } catch (e) {
// //                 console.error('Error fetching entries:', e);
// //             } finally {
// //                 setLoading(false);
// //             }
// //         };
// //         fetchEntries();
// //     }, []);
// //     if (!newData.length) return (
// //         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
// //             <EmptyState title="No entries yet" sub="Submit sprint entries to see your history here" btnLabel="Log First Sprint →" onBtn={onSwitchForm} />
// //         </div>
// //     );

// //     const sorted = [...newData].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
// //     const color = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
// //     return (
// //         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
// //             <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">
// //                 All Sprint Entries <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, marginLeft: 6, color: '#8a8a8a' }}>{newData.length} total</span>
// //             </div>
// //             <div className="bg-surface border border-border rounded-xl p-6 shadow-sm overflow-x-auto">
// //                 <table className="history-tbl w-full table-fixed border-collapse text-sm">

// //                     {/*  Column Width Control */}
// //                     <colgroup>
// //                         <col className="w-[140px]" />
// //                         <col className="w-[90px]" />
// //                         <col className="w-[110px]" />
// //                         <col className="w-[180px]" />
// //                         <col className="w-[100px]" />
// //                         <col className="w-[100px]" />
// //                         <col className="w-[110px]" />
// //                         <col className="w-[110px]" />
// //                         <col className="w-[70px]" />
// //                         <col className="w-[80px]" />
// //                         <col className="w-[120px]" />
// //                     </colgroup>

// //                     {/* ✅ HEADER */}
// //                     <thead>
// //                         <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
// //                             <th className="pb-2">Developer</th>
// //                             <th className="pb-2">Sprint</th>
// //                             <th className="pb-2">Week</th>
// //                             <th className="pb-2">Jira IDs</th>
// //                             <th className="pb-2 text-center">SP</th>
// //                             <th className="pb-2 text-center">Completion</th>
// //                             <th className="pb-2 text-center">Utilisation</th>
// //                             <th className="pb-2 text-center">Efficiency</th>
// //                             <th className="pb-2 text-center">Bugs</th>
// //                             <th className="pb-2 text-center">Goals</th>
// //                             <th className="pb-2 text-center">Action</th>
// //                         </tr>
// //                     </thead>

// //                     {/* ✅ BODY */}
// //                     <tbody>
// //                         {sorted.map(e => {
// //                             const goalsMet = e.goals.filter(g => g.achieved >= g.target).length;

// //                             return (
// //                                 <tr key={e.id} className="border-t border-[#eee] hover:bg-[#fafafa] transition">

// //                                     {/* Developer */}
// //                                     <td className="py-2">
// //                                         <div className="font-semibold">{e.name}</div>
// //                                         <div className="text-[11px] text-ink-400">{e.role || ''}</div>
// //                                     </td>

// //                                     {/* Sprint */}
// //                                     <td className="py-2">
// //                                         <span className="font-secondary text-xs px-2 py-1 rounded bg-[#f5f5f5]">
// //                                             {e.sprint}
// //                                         </span>
// //                                     </td>

// //                                     {/* Week */}
// //                                     <td className="py-2 text-xs text-ink-400 font-secondary">
// //                                         {e.weekStart || ''}
// //                                     </td>

// //                                     {/* Jira IDs */}
// //                                     <td className="py-2">
// //                                         <div className="flex flex-wrap gap-1 max-w-[160px]">
// //                                             {e.tasks.filter(t => t.jiraId).length ? (
// //                                                 e.tasks
// //                                                     .filter(t => t.jiraId)
// //                                                     .map((t, i) => (
// //                                                         <span
// //                                                             key={i}
// //                                                             className="text-[10px] font-secondary font-bold text-brand-600 bg-brand-50 px-2 py-[2px] rounded whitespace-nowrap"
// //                                                         >
// //                                                             {t.jiraId}
// //                                                         </span>
// //                                                     ))
// //                                             ) : (
// //                                                 <span className="text-ink-400 text-xs">—</span>
// //                                             )}
// //                                         </div>
// //                                     </td>

// //                                     {/* SP */}
// //                                     <td className="text-center font-semibold text-brand-600">
// //                                         {e.completed}/{e.committed}
// //                                     </td>

// //                                     {/* Completion */}
// //                                     <td className="text-center font-semibold">
// //                                         <span style={{ color: color(e.metrics.completion) }}>
// //                                             {e.metrics.completion}%
// //                                         </span>
// //                                     </td>

// //                                     {/* Utilisation */}
// //                                     <td className="text-center font-semibold">
// //                                         <span style={{ color: color(e.metrics.utilisation) }}>
// //                                             {e.metrics.utilisation}%
// //                                         </span>
// //                                     </td>

// //                                     {/* Efficiency */}
// //                                     <td className="text-center font-semibold">
// //                                         <span style={{ color: color(e.metrics.efficiency) }}>
// //                                             {e.metrics.efficiency}/100
// //                                         </span>
// //                                     </td>

// //                                     {/* Bugs */}
// //                                     <td className="text-center font-semibold">
// //                                         <span
// //                                             style={{
// //                                                 color:
// //                                                     e.bugs <= 1
// //                                                         ? '#059669'
// //                                                         : e.bugs <= 3
// //                                                             ? '#d97706'
// //                                                             : '#ff4b2b'
// //                                             }}
// //                                         >
// //                                             {e.bugs}
// //                                         </span>
// //                                     </td>

// //                                     {/* Goals */}
// //                                     <td className="text-center font-semibold">
// //                                         {goalsMet}/{e.goals.length}
// //                                     </td>

// //                                     {/* Actions */}
// //                                     <td className="text-center whitespace-nowrap">
// //                                         <button
// //                                             onClick={() => onEdit(e)}
// //                                             className="border border-ink-200 dark:border-white/10 rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 dark:hover:bg-ink-800"
// //                                         >
// //                                             Edit
// //                                         </button>

// //                                         <button
// //                                             onClick={() => onDelete(e.id)}
// //                                             className="ml-1 bg-rose-50 border border-rose-200 text-rose-600 rounded px-2 py-1 text-xs font-semibold hover:bg-rose-100"
// //                                         >
// //                                             Del
// //                                         </button>
// //                                     </td>

// //                                 </tr>
// //                             );
// //                         })}
// //                     </tbody>
// //                 </table>
// //             </div>
// //         </div>
// //     );
// // }

// // // ─── TOAST GLOBAL ──────────────────────────────────────────────────────────────
// // let _toastFn = null;
// // function showToastGlobal(msg, bg) { _toastFn && _toastFn(msg, bg); }

// // function Toast() {
// //     const [state, setState] = useState({ msg: '', bg: '', show: false });
// //     useEffect(() => {
// //         _toastFn = (msg, bg) => {
// //             setState({ msg, bg: bg || '', show: true });
// //             setTimeout(() => setState(s => ({ ...s, show: false })), 2800);
// //         };
// //     }, []);
// //     return (
// //         <div
// //             className={`fixed bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-white z-[9999] transition-all duration-300 pointer-events-none ${state.show ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-20'}`}
// //             style={{ background: state.bg || '#0b0b0b', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}
// //         >
// //             <span className="text-lg">{state.msg.slice(0, 2)}</span>
// //             <span>{state.msg.slice(2)}</span>
// //         </div>
// //     );
// // }


// // // ─── MAIN APP ──────────────────────────────────────────────────────────────────
// // export default function WeeklyPulse() {
// //     const [tab, setTab] = useState('form');
// //     const [entries, setEntries] = useState([]);
// //     const [editEntry, setEditEntry] = useState(null);

// //     const now = new Date();
// //     const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
// //     const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
// //     const fmt = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
// //     const weekChip = `Week ${getWeekNum(now)} · ${fmt(weekStart)} – ${fmt(weekEnd)}`;

// //     const transformEntries = (data) => {
// //         let item = data[0]
// //         const userStr = localStorage.getItem('authUserLD');
// //         const user = userStr ? JSON.parse(userStr) : null;


// //         return ({
// //             userId: user?.userID, // or from backend

// //             sprintLabel: item.sprint,
// //             weekStart: item.weekStart,
// //             weekEnd: item.weekEnd,
// //             daysPresent: item.days,

// //             spCommitted: item.committed,
// //             spCompleted: item.completed,
// //             bugsIntroduced: item.bugs,
// //             prReviews: item.reviews,
// //             spCarryover: item.carryover,
// //             blockers: item.blockers,

// //             selfRating: item.selfRating,
// //             achievements: item.achievements || "",
// //             challenges: item.challenges || "",
// //             nextFocus: item.nextFocus || "",

// //             tasks: item.tasks.map((t, i) => ({
// //                 jiraId: t.jiraId,
// //                 taskName: t.name,
// //                 storyPoints: t.sp,
// //                 product: t.product.toUpperCase().replace(" ", "_"),
// //                 module: t.module.toUpperCase().replace(" ", "_"),
// //                 taskType: t.type?.toUpperCase().replace(" ", "_"),
// //                 status: t.status?.toUpperCase(),
// //                 sortOrder: i + 1
// //             })),

// //             goals: item.goals.map((g, i) => ({
// //                 goalName: g.name,
// //                 targetPct: g.target,
// //                 achievedPct: g.achieved,
// //                 sortOrder: i + 1
// //             }))

// //         })
// //     }

// //     async function saveEntries(list) {
// //         const payload = transformEntries(list);
// //         try {
// //             const res = await axios.post("t2.0/authentificationUtilization/createSprintEntry", payload, {
// //                 headers: {
// //                     "Content-Type": "application/json",
// //                 },
// //             });

// //             const data = await res.json();

// //         }
// //         catch (e) {
// //             console.error('Error saving entries:', e);
// //         }
// //     }

// //     function handleSubmit(entry) {
// //         const existing = entries.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase() && e.sprint === entry.sprint);
// //         const next = existing >= 0 ? entries.map((e, i) => i === existing ? entry : e) : [...entries, entry];
// //         saveEntries(next);
// //         showToastGlobal('✅ Sprint entry saved successfully!');
// //         setTimeout(() => setTab('dashboard'), 900);
// //     }

// //     function handleDelete(id) {
// //         if (!confirm('Delete this sprint entry?')) return;
// //         saveEntries(entries.filter(e => e.id !== id));
// //         showToastGlobal('🗑 Entry deleted');
// //     }

// //     function handleEdit(entry) {
// //         setEditEntry(entry);
// //         setTab('form');
// //     }

// //     return (
// //         <div className="relative min-h-screen isolate text-ink-900 dark:text-white ">
// //             <style>{GLOBAL_STYLE}</style>

// //             {/* ── HEADER ── */}
// //             <header className="px-10 flex items-center justify-between h-16">
// //                 {/* Logo */}

// //                 {/* ── HeroUI Tabs inside header ── */}
// //                 <Tabs
// //                     className="wp-tabs"
// //                     selectedKey={tab}
// //                     onSelectionChange={key => setTab(String(key))}
// //                     variant="light"
// //                     aria-label="WeeklyPulse navigation"
// //                     disableAnimation={false}
// //                 >
// //                     <Tab key="form" title=" Log Sprint" />
// //                     <Tab key="dashboard" title=" Dashboard" />
// //                     <Tab key="history" title=" History" />
// //                 </Tabs>

// //                 {/* Week chip */}
// //             </header>

// //             {/* ── TAB PANELS ── */}
// //             {tab === 'form' && (
// //                 <FormTab
// //                     key={editEntry?.id || 'new'}
// //                     initialEntry={editEntry}
// //                     onSubmit={entry => { setEditEntry(null); handleSubmit(entry); }}
// //                     onSwitchDashboard={() => setTab('dashboard')}
// //                 />
// //             )}
// //             {tab === 'dashboard' && <DashboardTab entries={entries} onSwitchForm={() => setTab('form')} />}
// //             {tab === 'history' && <HistoryTab entries={entries} onDelete={handleDelete} onEdit={handleEdit} onSwitchForm={() => setTab('form')} />}

// //             <Toast />
// //         </div>
// //     );
// // }

// import { useState, useEffect, useRef, useCallback } from "react";
// import { Tabs, Tab, Input, Select, SelectItem } from "@/components/ui";
// import axios from "axios";
// import { DateRangePicker } from "@/components/ui";
// import { parseDate } from "@internationalized/date";

// // ─── CSS ───────────────────────────────────────────────────────────────────────
// const GLOBAL_STYLE = `
//   .wp-root::before {
//     content:'';position:absolute;inset:0;pointer-events:none;z-index:999;
//     background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
//     opacity:.4;
//   }
//   .wp-bar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
//     background:#0b0b0b;color:#fff;font-size:10px;padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:10;}
//   .wp-section-title::after{content:'';flex:1;height:1px;background:#e4e4e7;}
//   .wp-kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--kpi-color,#ff6a1f);}
//   .wp-textarea{resize:vertical;min-height:72px;line-height:1.5;width:100%;border:1.5px solid #d4d4d8;border-radius:8px;padding:10px 14px;font-size:14px;color:#0b0b0b;outline:none;transition:.15s;}
//   .wp-textarea:focus{border-color:#ff6a1f;background:#fff;box-shadow:0 0 0 3px rgba(232,83,10,.1);}
//   .wp-tabs [data-slot="tabList"]{background:transparent!important;padding:0!important;gap:4px!important;border-radius:0!important;}
//   .wp-tabs [data-slot="tab"]{padding:7px 18px!important;border-radius:6px!important;font-size:13px!important;font-weight:600!important;color:#8a8a8a!important;background:transparent!important;transition:background .15s,color .15s!important;height:auto!important;min-height:0!important;}
//   .wp-tabs [data-slot="tab"]:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;}
//   .wp-tabs [aria-selected="true"][data-slot="tab"],.wp-tabs [data-selected="true"][data-slot="tab"]{background:#ff6a1f!important;color:#fff!important;}
//   .wp-tabs [data-slot="tabContent"]{font-size:13px!important;font-weight:600!important;}
//   .wp-tabs [data-slot="cursor"]{display:none!important;}
//   .wp-tabs [data-slot="panel"]{padding:0!important;outline:none!important;}
// `;

// // ─── CONSTANTS ─────────────────────────────────────────────────────────────────
// const PRODUCTS = ['TapMind SDK', 'Display Ad Server', 'Video Ad Server', 'Hads Server', 'Proxy Server', 'AdCache', 'Mediation Adapter', 'Publisher Dashboard', 'Internal Tools', 'Other'];
// const MODULES = ['Android SDK', 'iOS SDK', 'Web SDK', 'Ad Refresh', 'Mediation', 'oRTB / Demand', 'GAM / AdMob', 'Unity LevelPlay', 'MAX (AppLovin)', 'Backend API', 'Pipeline / Kafka', 'Aerospike', 'ClickHouse', 'DevOps / Infra', 'Docs / QA', 'Other'];

// // ─── HELPERS ───────────────────────────────────────────────────────────────────
// function getWeekNum(d) {
//     const s = new Date(d.getFullYear(), 0, 1);
//     return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
// }
// function calcMetrics(committed, completed, days, bugs, selfRating) {
//     committed = parseFloat(committed) || 0;
//     completed = parseFloat(completed) || 0;
//     days = parseFloat(days) || 0;
//     bugs = parseFloat(bugs) || 0;
//     selfRating = parseFloat(selfRating) || 0;
//     const completion = committed > 0 ? Math.round((completed / committed) * 100) : 0;
//     const utilisation = Math.round((days / 5) * 100);
//     const qualityScore = Math.max(0, Math.min(100, 100 - bugs * 15));
//     const efficiency = Math.round(completion * 0.4 + utilisation * 0.35 + qualityScore * 0.25);
//     const overall = Math.round(efficiency * 0.6 + (selfRating * 10) * 0.4);
//     return { completion, utilisation, qualityScore, efficiency, overall };
// }
// function metricColor(v) {
//     return v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
// }
// function trendIcon(v) { return v >= 85 ? '▲' : v >= 65 ? '●' : '▼'; }

// // ─── RADAR SVG ─────────────────────────────────────────────────────────────────
// function buildRadar(values, labels, colors) {
//     const cx = 100, cy = 100, r = 72, n = values.length;
//     const a = i => (Math.PI * 2 * i / n) - Math.PI / 2;
//     const pt = (i, rad) => [cx + rad * Math.cos(a(i)), cy + rad * Math.sin(a(i))];
//     let h = '';
//     [.25, .5, .75, 1].forEach(f => {
//         const pts = Array.from({ length: n }, (_, i) => pt(i, r * f)).map(p => p.join(',')).join(' ');
//         h += `<polygon points="${pts}" fill="none" stroke="#e4e4e7" stroke-width="1"/>`;
//     });
//     for (let i = 0; i < n; i++) { const [x, y] = pt(i, r); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e4e4e7" stroke-width="1"/>`; }
//     const dpts = values.map((v, i) => pt(i, r * (v / 100))).map(p => p.join(',')).join(' ');
//     h += `<polygon points="${dpts}" fill="rgba(37,99,235,.12)" stroke="#ff6a1f" stroke-width="2"/>`;
//     values.forEach((v, i) => { const [x, y] = pt(i, r * (v / 100)); h += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[i]}" stroke="#fff" stroke-width="2"/>`; });
//     for (let i = 0; i < n; i++) {
//         const [x, y] = pt(i, r + 16);
//         const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
//         h += `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#8a8a8a" font-size="9" font-weight="700">${labels[i].toUpperCase()}</text>`;
//     }
//     return h;
// }

// // ─── EMPTY STATE ───────────────────────────────────────────────────────────────
// function EmptyState({ icon, title, sub, btnLabel, onBtn }) {
//     return (
//         <div className="text-center py-16 px-5 flex flex-col items-center gap-3.5">
//             <div className="text-5xl opacity-30">{icon}</div>
//             <div className="text-lg font-bold text-ink-500 dark:text-ink-400">{title}</div>
//             <div className="text-sm text-ink-400">{sub}</div>
//             <button onClick={onBtn} className="mt-1.5 px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-[9px] cursor-pointer border-none hover:bg-brand-700 transition-all">
//                 {btnLabel}
//             </button>
//         </div>
//     );
// }

// // ─── TASK ROW COMPONENT ────────────────────────────────────────────────────────
// function TaskRowInput({ task, onChange, onRemove }) {
//     const TASK_TYPES = ['Feature', 'Bug', 'Refactor', 'Test', 'Docs', 'Review', 'Infra', 'Research'];
//     const TASK_STATUSES = [{ key: 'done', label: 'Done' }, { key: 'partial', label: 'Partial' }, { key: 'missed', label: 'Missed' }, { key: 'carry', label: 'Carry' }];
//     return (
//         <div style={{ display: 'grid', gridTemplateColumns: '90px 2fr 80px 1fr 1fr 1.5fr 36px', gap: 10, alignItems: 'center' }} className="border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5 transition-all">
//             <Input size="sm" placeholder="TP-50" label="Jira ID" labelPlacement="outside"
//                 value={task.jiraId || ''} onValueChange={v => onChange('jiraId', v.toUpperCase())}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <Input size="sm" placeholder="e.g. Fix AdMob adapter crash" label="Task Name" labelPlacement="outside"
//                 value={task.name || ''} onValueChange={v => onChange('name', v)}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <Input size="sm" type="number" placeholder="3" label="SP" labelPlacement="outside"
//                 value={task.sp || ''} onValueChange={v => onChange('sp', v)}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <Select size="sm" label="Product" labelPlacement="outside"
//                 selectedKeys={[task.product || PRODUCTS[0]]} onSelectionChange={keys => onChange('product', Array.from(keys)[0])}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
//                 {PRODUCTS.map(p => <SelectItem key={p}>{p}</SelectItem>)}
//             </Select>
//             <Select size="sm" label="Module" labelPlacement="outside"
//                 selectedKeys={[task.module || MODULES[0]]} onSelectionChange={keys => onChange('module', Array.from(keys)[0])}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
//                 {MODULES.map(m => <SelectItem key={m}>{m}</SelectItem>)}
//             </Select>
//             <div className="flex flex-col gap-1">
//                 <div className="text-[10px] font-bold tracking-wide uppercase text-ink-400">Type &amp; Status</div>
//                 <div style={{ display: 'flex', gap: 4 }}>
//                     <Select size="sm" aria-label="Type"
//                         selectedKeys={[task.type || 'Feature']} onSelectionChange={keys => onChange('type', Array.from(keys)[0])}
//                         style={{ flex: 1 }}>
//                         {TASK_TYPES.map(t => <SelectItem key={t}>{t}</SelectItem>)}
//                     </Select>
//                     <Select size="sm" aria-label="Status"
//                         selectedKeys={[task.status || 'done']} onSelectionChange={keys => onChange('status', Array.from(keys)[0])}
//                         style={{ flex: 1 }}>
//                         {TASK_STATUSES.map(s => <SelectItem key={s.key}>{s.label}</SelectItem>)}
//                     </Select>
//                 </div>
//             </div>
//             <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">×</button>
//         </div>
//     );
// }

// // ─── GOAL ROW COMPONENT ────────────────────────────────────────────────────────
// function GoalRowInput({ goal, onChange, onRemove }) {
//     return (
//         <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 36px', gap: 10, alignItems: 'center' }} className="border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5">
//             <Input size="sm" placeholder="e.g. Zero crashes in prod" label="Goal Description" labelPlacement="outside"
//                 value={goal.name || ''} onValueChange={v => onChange('name', v)}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <Input size="sm" type="number" placeholder="100" label="Target %" labelPlacement="outside"
//                 value={goal.target || ''} onValueChange={v => onChange('target', v)}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <Input size="sm" type="number" placeholder="85" label="Achieved %" labelPlacement="outside"
//                 value={goal.achieved || ''} onValueChange={v => onChange('achieved', v)}
//                 classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
//             <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">×</button>
//         </div>
//     );
// }

// // ─── FORM FIELD ────────────────────────────────────────────────────────────────
// function FormGroup({ label, hint, children, full, half }) {
//     return (
//         <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1/-1' : half ? 'span 2' : undefined }}>
//             <label className="text-[11px] font-bold tracking-[1.2px] uppercase text-ink-500 dark:text-ink-400">
//                 {label}{hint && <span className="text-[10px] font-normal text-ink-400 tracking-normal ml-1.5 normal-case">{hint}</span>}
//             </label>
//             {children}
//         </div>
//     );
// }

// function AddBtn({ onClick, children }) {
//     return (
//         <button onClick={onClick}
//             className="mt-2.5 px-4 py-2 bg-transparent border-[1.5px] border-dashed border-ink-300 dark:border-white/15 rounded-lg text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer flex items-center gap-2 transition-all hover:border-brand-600 hover:text-brand-600 hover:bg-[rgba(232,83,10,.04)]">
//             {children}
//         </button>
//     );
// }

// // ─── FORM TAB ──────────────────────────────────────────────────────────────────
// function FormTab({ initialEntry, onSubmit, onSwitchDashboard }) {
//     const now = new Date();
//     const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
//     const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
//     const fmt = d => d.toISOString().slice(0, 10);

//     const isEdit = !!initialEntry;
//     const userStr = localStorage.getItem('authUserLD');
//     const user = userStr ? JSON.parse(userStr) : null;
//     // ── Initialise form state — pre-fill when editing ──────────────────────
//     const [f, setF] = useState(() => {
//         if (initialEntry) {
//             return {
//                 name: user.name || '',
//                 role: initialEntry.role || '',
//                 sprint: initialEntry.sprint || `W-${getWeekNum(now)}`,
//                 weekStart: initialEntry.weekStart || fmt(weekStart),
//                 weekEnd: initialEntry.weekEnd || fmt(weekEnd),
//                 days: String(initialEntry.days ?? ''),
//                 committed: String(initialEntry.committed ?? ''),
//                 completed: String(initialEntry.completed ?? ''),
//                 bugs: String(initialEntry.bugs ?? ''),
//                 reviews: String(initialEntry.reviews ?? ''),
//                 carryover: String(initialEntry.carryover ?? ''),
//                 blockers: String(initialEntry.blockers ?? ''),
//                 selfRating: String(initialEntry.selfRating ?? ''),
//                 achievements: initialEntry.achievements || '',
//                 challenges: initialEntry.challenges || '',
//                 nextFocus: initialEntry.nextFocus || '',
//             };
//         }
//         return {
//             name: user.name || '', role: '', sprint: `W-${getWeekNum(now)}`,
//             weekStart: fmt(weekStart), weekEnd: fmt(weekEnd),
//             days: '', committed: '', completed: '', bugs: '',
//             reviews: '', carryover: '', blockers: '', selfRating: '',
//             achievements: '', challenges: '', nextFocus: '',
//         };
//     });

//     const taskId = useRef(100);
//     const goalId = useRef(100);

//     // ── Pre-fill tasks & goals when editing ────────────────────────────────
//     const [tasks, setTasks] = useState(() => {
//         if (initialEntry?.tasks?.length) {
//             return initialEntry.tasks.map((t, i) => ({
//                 id: 100 + i,
//                 jiraId: t.jiraId || '',
//                 name: t.name || '',
//                 sp: String(t.sp ?? ''),
//                 product: t.product || PRODUCTS[0],
//                 module: t.module || MODULES[0],
//                 type: t.type || 'Feature',
//                 status: t.status || 'done',
//             }));
//         }
//         return [];
//     });

//     const [goals, setGoals] = useState(() => {
//         if (initialEntry?.goals?.length) {
//             return initialEntry.goals.map((g, i) => ({
//                 id: 200 + i,
//                 name: g.name || '',
//                 target: String(g.target ?? ''),
//                 achieved: String(g.achieved ?? ''),
//             }));
//         }
//         return [];
//     });

//     const live = (f.committed || f.completed) ? calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating) : null;
//     const lc = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
//     const ll = v => v >= 85 ? '▲ On Target' : v >= 65 ? '● Moderate' : '▼ Below';

//     function addTask() { const id = taskId.current++; setTasks(t => [...t, { id, jiraId: '', name: '', sp: '', product: PRODUCTS[0], module: MODULES[0], type: 'Feature', status: 'done' }]); }
//     function removeTask(id) { setTasks(t => t.filter(x => x.id !== id)); }
//     function updateTask(id, key, val) { setTasks(t => t.map(x => x.id === id ? { ...x, [key]: val } : x)); }
//     function addGoal() { const id = goalId.current++; setGoals(g => [...g, { id, name: '', target: '', achieved: '' }]); }
//     function removeGoal(id) { setGoals(g => g.filter(x => x.id !== id)); }
//     function updateGoal(id, key, val) { setGoals(g => g.map(x => x.id === id ? { ...x, [key]: val } : x)); }

//     function handleSubmit() {
//         if (!f.name.trim()) { showToastGlobal('⚠️ Please enter your name!', '#ff6a1f'); return; }
//         if (!f.sprint.trim()) { showToastGlobal('⚠️ Please enter the sprint/week label!', '#ff6a1f'); return; }
//         const metrics = calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating);
//         const entry = {
//             // ← carry original id when editing so saveEntries can detect PUT
//             id: initialEntry?.id ?? Date.now(),
//             ...f,
//             committed: parseFloat(f.committed) || 0,
//             completed: parseFloat(f.completed) || 0,
//             days: parseFloat(f.days) || 5,
//             bugs: parseFloat(f.bugs) || 0,
//             reviews: parseFloat(f.reviews) || 0,
//             carryover: parseFloat(f.carryover) || 0,
//             blockers: parseFloat(f.blockers) || 0,
//             selfRating: parseFloat(f.selfRating) || 0,
//             metrics,
//             tasks: tasks.filter(t => t.name).map(t => ({ ...t, sp: parseFloat(t.sp) || 0 })),
//             goals: goals.filter(g => g.name).map(g => ({ ...g, target: parseFloat(g.target) || 100, achieved: parseFloat(g.achieved) || 0 })),
//             timestamp: initialEntry?.timestamp ?? new Date().toISOString(),
//             managerNote: initialEntry?.managerNote ?? '',
//         };
//         onSubmit(entry);
//     }

//     function handleReset() {
//         setF({ name: '', role: '', sprint: `W-${getWeekNum(now)}`, weekStart: fmt(weekStart), weekEnd: fmt(weekEnd), days: '', committed: '', completed: '', bugs: '', reviews: '', carryover: '', blockers: '', selfRating: '', achievements: '', challenges: '', nextFocus: '' });
//         setTasks([]);
//         setGoals([]);
//     }

//     const inp = (id, extra = {}) => ({ value: f[id], onChange: e => setF(p => ({ ...p, [id]: e.target.value })), ...extra });

//     return (
//         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
//             <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', overflow: 'hidden', marginBottom: 28 }}>
//                 {/* Header */}
//                 <div style={{ padding: '24px 30px', display: 'flex', alignItems: 'center', gap: 16 }}>
//                     <div>
//                         {/* ← Edit badge shown when editing */}
//                         <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0b0b0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
//                             {isEdit ? 'Edit Sprint Entry' : 'Weekly Sprint Entry'}
//                             {isEdit && (
//                                 <span style={{ fontSize: 12, fontWeight: 700, background: '#fff3e0', color: '#ff6a1f', border: '1px solid #fdd8b5', borderRadius: 20, padding: '2px 10px', letterSpacing: 1 }}>
//                                     EDITING · {initialEntry.sprint}
//                                 </span>
//                             )}
//                         </h2>
//                         <p style={{ fontSize: 13, color: '#8a8a8a' }}>
//                             {isEdit ? 'Update your sprint details — changes will be saved via PUT' : 'Fill in your sprint details — all metrics are calculated automatically'}
//                         </p>
//                     </div>
//                 </div>

//                 <div style={{ padding: '28px 30px' }}>
//                     {/* Identity */}
//                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Developer Identity</div>
//                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
//                         <FormGroup label="Full Name"><Input variant="bordered" size="sm" placeholder="e.g. name" {...inp('name')} onValueChange={v => setF(p => ({ ...p, name: v }))} /></FormGroup>
//                         <FormGroup label="Role / Team"><Input variant="bordered" size="sm" placeholder="e.g. Engineer" {...inp('role')} onValueChange={v => setF(p => ({ ...p, role: v }))} /></FormGroup>
//                         <FormGroup label="Sprint / Week Label"><Input variant="bordered" size="sm" placeholder="e.g. W-24 / Sprint 20" {...inp('sprint')} onValueChange={v => setF(p => ({ ...p, sprint: v }))} /></FormGroup>
//                         <FormGroup label="Week Range">
//                             <DateRangePicker
//                                 variant="bordered"
//                                 size="sm"
//                                 value={
//                                     f.weekStart && f.weekEnd
//                                         ? { start: parseDate(f.weekStart), end: parseDate(f.weekEnd) }
//                                         : null
//                                 }
//                                 onChange={(range) => {
//                                     setF(p => ({
//                                         ...p,
//                                         weekStart: range?.start?.toString() || '',
//                                         weekEnd: range?.end?.toString() || '',
//                                     }));
//                                 }}
//                             />
//                         </FormGroup>
//                         <FormGroup label="Days Present" hint="(out of 5)">
//                             <Input variant="bordered" size="sm" type="number" placeholder="5" {...inp('days')} onValueChange={v => setF(p => ({ ...p, days: v }))} />
//                         </FormGroup>
//                     </div>

//                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

//                     {/* Story Points */}
//                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Story Points</div>
//                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
//                         <FormGroup label="Story Points Committed"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 20" {...inp('committed')} onValueChange={v => setF(p => ({ ...p, committed: v }))} /></FormGroup>
//                         <FormGroup label="Story Points Completed"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 17" {...inp('completed')} onValueChange={v => setF(p => ({ ...p, completed: v }))} /></FormGroup>
//                         <FormGroup label="Bugs Introduced"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 2" {...inp('bugs')} onValueChange={v => setF(p => ({ ...p, bugs: v }))} /></FormGroup>
//                         <FormGroup label="PRs / Code Reviews Done"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 4" {...inp('reviews')} onValueChange={v => setF(p => ({ ...p, reviews: v }))} /></FormGroup>
//                         <FormGroup label="Carry-over SP from last week"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 3" {...inp('carryover')} onValueChange={v => setF(p => ({ ...p, carryover: v }))} /></FormGroup>
//                         <FormGroup label="Blockers Encountered"><Input variant="bordered" size="sm" type="number" placeholder="e.g. 1" {...inp('blockers')} onValueChange={v => setF(p => ({ ...p, blockers: v }))} /></FormGroup>
//                     </div>

//                     {/* Live Preview */}
//                     {live && (
//                         <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
//                             <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 12 }}>⚡ Live Auto-Calculation</div>
//                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
//                                 {[
//                                     { k: 'Completion Rate', v: live.completion + '%', c: lc(live.completion), l: ll(live.completion) },
//                                     { k: 'Utilisation', v: live.utilisation + '%', c: lc(live.utilisation), l: ll(live.utilisation) },
//                                     { k: 'Quality Score', v: live.qualityScore + '/100', c: lc(live.qualityScore), l: ll(live.qualityScore) },
//                                     { k: 'Efficiency Score', v: live.efficiency + '/100', c: lc(live.efficiency), l: ll(live.efficiency) },
//                                 ].map(m => (
//                                     <div key={m.k} style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, padding: '12px 14px' }}>
//                                         <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>{m.k}</div>
//                                         <div style={{ fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
//                                         <div style={{ fontSize: 11, color: m.c, marginTop: 4, fontWeight: 600 }}>{m.l}</div>
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>
//                     )}

//                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

//                     {/* Tasks */}
//                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Tasks Worked This Week</div>
//                     <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
//                         {tasks.map(t => (
//                             <TaskRowInput key={t.id} task={t} onChange={(k, v) => updateTask(t.id, k, v)} onRemove={() => removeTask(t.id)} />
//                         ))}
//                     </div>
//                     <AddBtn onClick={addTask}>＋ Add Task</AddBtn>

//                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

//                     {/* Goals */}
//                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">
//                         Weekly Goals <span style={{ fontSize: 10, color: '#8a8a8a', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>Set targets and track what you achieved</span>
//                     </div>
//                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
//                         {goals.map(g => (
//                             <GoalRowInput key={g.id} goal={g} onChange={(k, v) => updateGoal(g.id, k, v)} onRemove={() => removeGoal(g.id)} />
//                         ))}
//                     </div>
//                     <AddBtn onClick={addGoal}>＋ Add Goal</AddBtn>

//                     <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

//                     {/* Reflection */}
//                     <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Self Reflection</div>
//                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
//                         <FormGroup label="Key Achievements This Week" full>
//                             <textarea className="wp-textarea" placeholder="What did you accomplish? What are you proud of?" {...inp('achievements')} />
//                         </FormGroup>
//                         <FormGroup label="Blockers / Challenges" full>
//                             <textarea className="wp-textarea" placeholder="What slowed you down? What do you need help with?" {...inp('challenges')} />
//                         </FormGroup>
//                         <FormGroup label="Focus Area Next Week" half>
//                             <textarea className="wp-textarea" placeholder="What is your top priority next sprint?" style={{ minHeight: 54 }} {...inp('nextFocus')} />
//                         </FormGroup>
//                         <FormGroup label="Confidence Score" hint="(1–10)">
//                             <Input variant="bordered" size="sm" type="number" placeholder="7" {...inp('selfRating')} onValueChange={v => setF(p => ({ ...p, selfRating: v }))} />
//                         </FormGroup>
//                     </div>

//                     {/* Submit Row */}
//                     <div className="flex items-center gap-3.5 mt-6">
//                         <button onClick={handleSubmit}
//                             className="flex items-center gap-2.5 px-8 py-3 text-white text-[15px] font-bold rounded-[10px] cursor-pointer transition-all border-none"
//                             style={{ background: isEdit ? '#0b0b0b' : '#ff6a1f' }}
//                         >
//                             <span>{isEdit ? 'Save Changes' : 'Submit Sprint Entry'}</span>
//                             <span>{isEdit ? '✓' : '→'}</span>
//                         </button>
//                         <button onClick={handleReset} className="px-5 py-3 bg-transparent border-[1.5px] border-ink-300 dark:border-white/15 rounded-[10px] text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer transition-all">
//                             Reset
//                         </button>
//                         {isEdit && (
//                             <button onClick={onSwitchDashboard} className="px-5 py-3 bg-transparent border-[1.5px] border-ink-300 dark:border-white/15 rounded-[10px] text-sm font-semibold text-ink-400 cursor-pointer transition-all">
//                                 Cancel
//                             </button>
//                         )}
//                         <span className="text-xs text-ink-400 ml-auto">
//                             {isEdit ? `Editing entry ID: ${initialEntry.id}` : 'All fields with auto-calc will update your dashboard instantly'}
//                         </span>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

// // ─── mapApiItem (unchanged) ────────────────────────────────────────────────────
// function mapApiItem(item) {
//     return {
//         id: item.id,
//         name: item.userName,
//         role: item.userEmail || '',
//         sprint: item.sprintLabel,
//         weekStart: item.weekStart,
//         weekEnd: item.weekEnd,
//         days: item.daysPresent,
//         committed: item.spCommitted,
//         completed: item.spCompleted,
//         bugs: item.bugsIntroduced,
//         reviews: item.prReviews,
//         carryover: item.spCarryover,
//         blockers: item.blockers,
//         selfRating: item.selfRating,
//         achievements: item.achievements || '',
//         challenges: item.challenges || '',
//         nextFocus: item.nextFocus || '',
//         managerNote: item.managerNote || '',
//         timestamp: item.entryTimestamp,
//         metrics: {
//             completion: item.scoreCompletion,
//             utilisation: item.scoreUtilisation,
//             qualityScore: item.scoreQuality,
//             efficiency: item.scoreEfficiency,
//             overall: item.scoreOverall,
//         },
//         radarFromApi: item.radar,
//         tasks: (item.tasks || []).map(t => ({
//             id: t.id,
//             jiraId: t.jiraId,
//             name: t.taskName,
//             sp: t.storyPoints,
//             product: t.product,
//             module: t.module,
//             type: t.taskType,
//             status: t.status?.toLowerCase(),
//         })),
//         goals: (item.goals || []).map(g => ({
//             name: g.goalName,
//             target: g.targetPct,
//             achieved: g.achievedPct,
//         })),
//     };
// }

// // ─── DASHBOARD TAB (unchanged) ─────────────────────────────────────────────────
// function DashboardTab({ entries, onSwitchForm }) {
//     const authUserLD = localStorage.getItem("authUserLD");
//     const [selectedUser, setSelectedUser] = useState(null);
//     const [users, setUsers] = useState([]);
//     useEffect(() => {
//         const fetchUsers = async () => {
//             try {
//                 const body = {
//                     filter: "",
//                     searchText: "",
//                     departmentID: 24
//                 };

//                 const res = await axios.post(
//                     "/t2.0/authentificationUtilization/users/read?page=0&size=0",
//                     body,
//                     {
//                         headers: {
//                             "Content-Type": "application/json",
//                             Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
//                         },
//                     }
//                 );

//                 const usersData = res.data.response.users || [];

//                 const formatted: User[] = usersData.map((u: any) => ({
//                     userID: u.userID,
//                     userName: u.userName,
//                     // departmentName: u.departmentName || "N/A",
//                     // departmentID: u.departmentID,

//                 }));

//                 setUsers(formatted);

//                 if (formatted.length > 0) {
//                     setSelectedUser(formatted[0]);
//                 }
//                 console.log("Users formatted:", formatted);
//             } catch (err) {
//                 console.error("Error fetching users:", err);
//             }
//         };

//         fetchUsers();


//     }, []);

//     const [dashDev, setDashDev] = useState(null);
//     const [weekFilter, setWeekFilter] = useState('all');
//     const [managerNote, setManagerNote] = useState('');
//     const [newData, setNewData] = useState([]);
//     const [loading, setLoading] = useState(true);

//     const [weekRange, setWeekRange] = useState(() => {
//         const now = new Date();
//         const start = new Date(now);
//         start.setDate(now.getDate() - now.getDay() + 1);

//         const end = new Date(start);
//         end.setDate(start.getDate() + 4);

//         return {
//             start,
//             end
//         };
//     });


//     const displayEntries = newData.length ? newData : entries;
//     const names = [...new Set(users.map(e => e.userName))].sort();
//     const sprints = [...new Set(displayEntries.map(e => e.sprint))].sort();
//     const selectedDev = dashDev || (displayEntries.length ? displayEntries[displayEntries.length - 1].name : null);
//     const devEntries = displayEntries.filter(e => e.name === selectedDev).sort((a, b) => a.sprint.localeCompare(b.sprint));
//     const cur = weekFilter === 'all' ? devEntries[devEntries.length - 1] : (devEntries.find(e => e.sprint === weekFilter) || devEntries[devEntries.length - 1]);

//     useEffect(() => {
//         const fetchEntries = async () => {


//             try {
//                 setLoading(true);

//                 const result = await axios.get(
//                     `t2.0/authentificationUtilization/getSprintEntry?userId=${selectedUser?.userID}&from=${weekRange.start.toISOString().slice(0, 10)}&to=${weekRange.end.toISOString().slice(0, 10)}`
//                 );

//                 const mapped = result.data.data.content.map(mapApiItem);
//                 setNewData(mapped);

//             } catch (e) {
//                 console.error('Error fetching entries:', e);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchEntries();

//     }, [weekRange, selectedUser])

//     useEffect(() => { setManagerNote(cur?.managerNote || ''); }, [cur?.id]);

//     if (loading) return <div style={{ margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: 14 }}>Loading dashboard...</div>;
//     if (!displayEntries.length) return (
//         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
//             <div className="flex gap-3">
//                 <DateRangePicker
//                     variant="bordered"
//                     size="md"
//                     value={{
//                         start: parseDate(weekRange.start.toISOString().slice(0, 10)),
//                         end: parseDate(weekRange.end.toISOString().slice(0, 10)),
//                     }}
//                     onChange={(range) => {
//                         setWeekRange({
//                             start: new Date(range.start.toString()),
//                             end: new Date(range.end.toString())
//                         });
//                     }}
//                 />
//                 <Select
//                     selectedKeys={[selectedUser?.userID?.toString()]}
//                     onSelectionChange={(keys) => {
//                         const id = Number(Array.from(keys)[0]);
//                         const user = users.find(u => u.userID === id);
//                         setSelectedUser(user);
//                         setWeekFilter('all');
//                     }}
//                 >
//                     {users.map(u => (
//                         <SelectItem key={u.userID}>
//                             {u.userName}
//                         </SelectItem>
//                     ))}
//                 </Select>
//             </div>

//             <EmptyState title="No sprint data yet" sub="Submit your first weekly sprint entry to see your dashboard" btnLabel="Go to Sprint Entry →" onBtn={onSwitchForm} />
//         </div>
//     );
//     if (!cur) return null;

//     const m = cur.metrics;
//     const goalsMet = cur.goals.filter(g => g.achieved >= g.target).length;
//     const tasksTotal = cur.tasks.length;
//     const tasksDone = cur.tasks.filter(t => t.status === 'done').length;
//     const maxSP = Math.max(...devEntries.map(e => Math.max(e.committed, e.completed, 1)));
//     const radar = cur.radarFromApi;
//     const radarVals = radar
//         ? [radar.utilisation, radar.velocity, radar.reviews, radar.quality, radar.goals, radar.self]
//         : [m.utilisation, m.completion, Math.min(100, cur.reviews * 20), m.qualityScore, goalsMet > 0 ? Math.round((goalsMet / Math.max(cur.goals.length, 1)) * 100) : 0, Math.min(100, cur.selfRating * 10)];
//     const radarLabels = ['Util', 'Velocity', 'Reviews', 'Quality', 'Goals', 'Self'];
//     const radarColors = ['#ff6a1f', '#ff6a1f', '#059669', '#ff6a1f', '#d97706', '#0891b2'];
//     const score = m.overall || m.efficiency;
//     const scoreColor = metricColor(score);
//     const scoreLabel = score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : 'NEEDS FOCUS';
//     const circumference = 2 * Math.PI * 36;
//     const dashOffset = circumference * (1 - score / 100);
//     const statusTag = { done: { lbl: '✓ Done' }, partial: { lbl: '◑ Partial' }, missed: { lbl: '✗ Missed' }, carry: { lbl: '→ Carry' } };
//     const tagStyle = { done: { background: 'rgba(22,163,74,.1)', color: '#059669' }, partial: { background: 'rgba(202,138,4,.1)', color: '#d97706' }, missed: { background: 'rgba(220,38,38,.1)', color: '#ff4b2b' }, carry: { background: 'rgba(107,114,128,.1)', color: '#6b7280' } };

//     return (
//         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 30, padding: '8px 18px 8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)' }}>
//                     <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ff6a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
//                         {selectedDev.split(' ').map(w => w[0]).join('').slice(0, 2)}
//                     </div>
//                     <div><div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDev}</div><div style={{ fontSize: 11, color: '#8a8a8a' }}>{cur.role || 'Developer'}</div></div>
//                 </div>
//                 <div >
//                     <DateRangePicker
//                         variant="bordered"
//                         size="md"
//                         value={{
//                             start: parseDate(weekRange.start.toISOString().slice(0, 10)),
//                             end: parseDate(weekRange.end.toISOString().slice(0, 10)),
//                         }}
//                         onChange={(range) => {
//                             setWeekRange({
//                                 start: new Date(range.start.toString()),
//                                 end: new Date(range.end.toString())
//                             });
//                         }}
//                     />

//                 </div>
//                 <div className="w-80">
//                     <Select
//                         className="w-full"
//                         size="md"
//                         selectedKeys={[selectedUser?.userID?.toString()]}
//                         onSelectionChange={(keys) => {
//                             const id = Number(Array.from(keys)[0]);
//                             const user = users.find(u => u.userID === id);
//                             setSelectedUser(user);
//                             setWeekFilter('all');
//                         }}
//                     >
//                         {users.map(u => (
//                             <SelectItem key={u.userID}>
//                                 {u.userName}
//                             </SelectItem>
//                         ))}
//                     </Select>
//                 </div>
//             </div>
//             <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-3.5">Performance Overview · {cur.sprint} ({cur.weekStart} → {cur.weekEnd})</div>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
//                 {[
//                     { label: 'Completion Rate', val: `${m.completion}%`, sub: `${cur.completed}/${cur.committed} SP`, c: metricColor(m.completion), badge: trendIcon(m.completion) + ' ' + (m.completion >= 85 ? 'On Target' : m.completion >= 65 ? 'Moderate' : 'Below') },
//                     { label: 'Utilisation', val: `${m.utilisation}%`, sub: `${cur.days}/5 days logged`, c: metricColor(m.utilisation), badge: trendIcon(m.utilisation) + ' Capacity' },
//                     { label: 'Quality Score', val: `${m.qualityScore}`, sub: `${cur.bugs} bug${cur.bugs !== 1 ? 's' : ''} introduced`, c: metricColor(m.qualityScore), badge: trendIcon(m.qualityScore) + ' ' + (m.qualityScore >= 85 ? 'Clean' : 'Review needed') },
//                     { label: 'Efficiency Score', val: `${m.efficiency}`, sub: 'Composite /100', c: metricColor(m.efficiency), badge: trendIcon(m.efficiency) + ' Efficiency' },
//                     { label: 'Goals Met', val: `${goalsMet}/${cur.goals.length}`, sub: `${tasksDone}/${tasksTotal} tasks done`, c: metricColor(goalsMet / Math.max(cur.goals.length, 1) * 100), badge: goalsMet === cur.goals.length && cur.goals.length > 0 ? 'All met' : goalsMet > 0 ? 'Partial' : 'Missed', badgeColor: 'rgba(22,163,74,.1)', badgeTextColor: '#059669' },
//                 ].map((k, i) => (
//                     <div key={i} className="wp-kpi relative overflow-hidden rounded-xl p-5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', '--kpi-color': k.c } as React.CSSProperties}>
//                         <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 8 }}>{k.label}</div>
//                         <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: k.c, marginBottom: 4 }}>{k.val}</div>
//                         <div style={{ fontSize: 11, color: '#8a8a8a', fontFamily: 'monospace' }}>{k.sub}</div>
//                         <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, marginTop: 8, background: k.badgeColor || `${k.c}22`, color: k.badgeTextColor || k.c }}>{k.badge}</div>
//                     </div>
//                 ))}
//             </div>
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
//                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>Sprint Velocity Trend <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{devEntries.length} weeks</span></div>
//                     <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
//                         {devEntries.map(e => {
//                             const cH = Math.round((e.committed / maxSP) * 100);
//                             const dH = Math.round((e.completed / maxSP) * 100);
//                             const pct = e.committed > 0 ? Math.round((e.completed / e.committed) * 100) : 0;
//                             return (
//                                 <div key={e.sprint} className="flex-1 flex flex-col items-center gap-1">
//                                     <div className="flex-1 flex items-end gap-[3px] w-full">
//                                         <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-white/10" style={{ height: `${cH}%` }} data-tip={`Committed: ${e.committed}SP`} />
//                                         <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative" style={{ height: `${dH}%`, background: 'linear-gradient(180deg,#ff6a1f,#e85511)' }} data-tip={`Done: ${e.completed}SP (${pct}%)`} />
//                                     </div>
//                                     <div style={{ fontSize: 10, color: '#8a8a8a', fontFamily: 'monospace' }}>{e.sprint}</div>
//                                 </div>
//                             );
//                         })}
//                     </div>
//                     <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
//                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'inline-block' }} /> Committed</div>
//                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#ff6a1f', display: 'inline-block' }} /> Completed</div>
//                     </div>
//                 </div>
//                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>Goal Achievement <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{goalsMet}/{cur.goals.length} met</span></div>
//                     {cur.goals.length ? cur.goals.map((g, i) => {
//                         const pct = Math.min(100, Math.round((g.achieved / g.target) * 100));
//                         const c = g.achieved >= g.target ? '#059669' : g.achieved >= g.target * .7 ? '#d97706' : '#ff4b2b';
//                         return (
//                             <div key={i} style={{ marginBottom: 14 }}>
//                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
//                                     <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
//                                     <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: c }}>{g.achieved}%</div>
//                                 </div>
//                                 <div style={{ height: 7, background: '#f4f4f5', borderRadius: 20, overflow: 'hidden' }}>
//                                     <div style={{ width: `${pct}%`, background: c, height: '100%', borderRadius: 20 }} />
//                                 </div>
//                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
//                                     <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#8a8a8a' }}>Target: {g.target}%</div>
//                                     <div style={{ fontSize: 10, fontFamily: 'monospace', color: c }}>{g.achieved >= g.target ? '✓ Achieved' : '✗ Not met'}</div>
//                                 </div>
//                             </div>
//                         );
//                     }) : <div style={{ color: '#8a8a8a', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No goals set for this week</div>}
//                 </div>
//             </div>
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
//                 <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', gridColumn: 'span 2' }}>
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Tasks This Week</div>
//                     <table className="w-full border-collapse">
//                         <thead><tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a8a' }}>
//                             <th style={{ padding: '4px 8px', textAlign: 'center' }}>Jira ID</th><th style={{ padding: '4px 8px' }}>Task</th><th style={{ padding: '4px 8px', textAlign: 'center' }}>SP</th><th style={{ padding: '4px 8px', textAlign: 'center' }}>Product</th><th style={{ padding: '4px 8px', textAlign: 'center' }}>Module</th><th style={{ padding: '4px 8px', textAlign: 'center' }}>Type</th><th style={{ padding: '4px 8px', textAlign: 'center' }}>Status</th>
//                         </tr></thead>
//                         <tbody>
//                             {cur.tasks.length ? cur.tasks.map((t, i) => (
//                                 <tr key={i} style={{ borderTop: '1px solid #f0ede8' }}>
//                                     <td style={{ padding: '8px', textAlign: 'center' }}>{t.jiraId ? <a href={`https://tapminds.atlassian.net/browse/${t.jiraId}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#ff6a1f', textDecoration: 'none', background: 'rgba(37,99,235,.08)', padding: '2px 8px', borderRadius: 5 }}>{t.jiraId} ↗</a> : <span style={{ color: '#8a8a8a', fontSize: 11 }}>—</span>}</td>
//                                     <td style={{ padding: '8px', textAlign: 'center', fontWeight: 500, fontSize: 13 }}>{t.name}</td>
//                                     <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff6a1f' }}>{t.sp}</span></td>
//                                     <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontSize: 11, color: '#6a6a6a' }}>{t.product || '—'}</span></td>
//                                     <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontSize: 11, color: '#ff6a1f', background: 'rgba(124,58,237,.07)', padding: '2px 8px', borderRadius: 5 }}>{t.module || '—'}</span></td>
//                                     <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: '#8a8a8a' }}>{t.type}</td>
//                                     <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...tagStyle[t.status] }}>{statusTag[t.status]?.lbl}</span></td>
//                                 </tr>
//                             )) : <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8a8a8a', padding: 20 }}>No tasks logged</td></tr>}
//                         </tbody>
//                     </table>
//                 </div>
//                 <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column' }}>
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Performance Radar</div>
//                     <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
//                         <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: buildRadar(radarVals, radarLabels, radarColors) }} />
//                     </div>
//                     <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
//                         {radarLabels.map((l, i) => (
//                             <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                                 <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8a8a8a' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: radarColors[i], display: 'inline-block' }} />{l}</span>
//                                 <span style={{ fontFamily: 'monospace', fontSize: 11, color: radarColors[i], fontWeight: 600 }}>{radarVals[i]}</span>
//                             </div>
//                         ))}
//                     </div>
//                     <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
//                         <svg width="88" height="88" viewBox="0 0 88 88">
//                             <circle cx="44" cy="44" r="36" fill="none" stroke="#f4f4f5" strokeWidth="8" />
//                             <circle cx="44" cy="44" r="36" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" transform="rotate(-90 44 44)" style={{ transition: '.6s' }} />
//                             <text x="44" y="50" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="18" fontWeight="900" fill={scoreColor}>{score}</text>
//                         </svg>
//                         <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: scoreColor }}>{scoreLabel}</div>
//                     </div>
//                 </div>
//             </div>
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
//                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Developer Reflection</div>
//                     {cur.achievements && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#059669', marginBottom: 6 }}>✓ Achievements</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.achievements}</div></div>}
//                     {cur.challenges && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff4b2b', marginBottom: 6 }}>⚠ Blockers</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.challenges}</div></div>}
//                     {cur.nextFocus && <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff6a1f', marginBottom: 6 }}>→ Next Week Focus</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.nextFocus}</div></div>}
//                     {!cur.achievements && !cur.challenges && !cur.nextFocus && <div style={{ textAlign: 'center', color: '#8a8a8a', padding: 20, fontSize: 13 }}>No reflection notes added</div>}
//                 </div>
//                 <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
//                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Manager Review Note</div>
//                     <textarea value={managerNote} onChange={e => setManagerNote(e.target.value)} placeholder="Add manager feedback, coaching notes, or observations for this sprint…" className="wp-textarea" style={{ minHeight: 64 }} />
//                     <button onClick={() => showToastGlobal('📝 Manager note saved!')} className="mt-2 px-4 py-2 bg-ink-900 text-white text-xs font-bold rounded-[7px] cursor-pointer border-none">Save Note</button>
//                     <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e4e4e7' }}>
//                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
//                             {[
//                                 { label: 'Reviews Done', val: cur.reviews, color: '#ff6a1f' },
//                                 { label: 'Carry-over SP', val: cur.carryover, color: '#d97706' },
//                                 { label: 'Blockers', val: cur.blockers, color: '#ff4b2b' },
//                                 { label: 'Self Rating', val: `${cur.selfRating}/10`, color: '#ff6a1f' },
//                             ].map(x => (
//                                 <div key={x.label} style={{ borderRadius: 8, padding: 12 }} className="shadow-md">
//                                     <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 4 }}>{x.label}</div>
//                                     <div style={{ fontSize: 20, fontWeight: 800, color: x.color }}>{x.val}</div>
//                                 </div>
//                             ))}
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

// // ─── HISTORY TAB ───────────────────────────────────────────────────────────────
// function HistoryTab({ entries, onDelete, onEdit, onSwitchForm }) {
//     const [newData, setNewData] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const userStr = localStorage.getItem('authUserLD');
//     const user = userStr ? JSON.parse(userStr) : null;
//     const [weekRange, setWeekRange] = useState(() => {
//         const now = new Date();
//         const start = new Date(now);
//         start.setDate(now.getDate() - now.getDay() + 1);

//         const end = new Date(start);
//         end.setDate(start.getDate() + 4);

//         return {
//             start,
//             end
//         };
//     });
//     const authUserLD = localStorage.getItem("authUserLD");
//     const [selectedUser, setSelectedUser] = useState(null);
//     const [users, setUsers] = useState([]);
//     useEffect(() => {
//         const fetchUsers = async () => {
//             try {
//                 const body = {
//                     filter: "",
//                     searchText: "",
//                     departmentID: 24
//                 };

//                 const res = await axios.post(
//                     "/t2.0/authentificationUtilization/users/read?page=0&size=0",
//                     body,
//                     {
//                         headers: {
//                             "Content-Type": "application/json",
//                             Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
//                         },
//                     }
//                 );

//                 const usersData = res.data.response.users || [];

//                 const formatted: User[] = usersData.map((u: any) => ({
//                     userID: u.userID,
//                     userName: u.userName,
//                     // departmentName: u.departmentName || "N/A",
//                     // departmentID: u.departmentID,

//                 }));

//                 setUsers(formatted);

//                 if (formatted.length > 0) {
//                     setSelectedUser(formatted[0]);
//                 }
//                 console.log("Users formatted:", formatted);
//             } catch (err) {
//                 console.error("Error fetching users:", err);
//             }
//         };

//         fetchUsers();


//     }, []);
//     useEffect(() => {
//         const fetchEntries = async () => {


//             try {
//                 setLoading(true);

//                 const result = await axios.get(
//                     `t2.0/authentificationUtilization/getSprintEntry?userId=${selectedUser?.userID}&from=${weekRange.start.toISOString().slice(0, 10)}&to=${weekRange.end.toISOString().slice(0, 10)}`
//                 );

//                 const mapped = result.data.data.content.map(mapApiItem);
//                 setNewData(mapped);

//             } catch (e) {
//                 console.error('Error fetching entries:', e);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchEntries();

//     }, [weekRange, selectedUser]);

//     if (loading) return <div style={{ margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: 14 }}>Loading history...</div>;
//     if (!newData.length) return (
//         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
//             <div className="flex gap-3">
//                 <DateRangePicker
//                     variant="bordered"
//                     size="md"
//                     value={{
//                         start: parseDate(weekRange.start.toISOString().slice(0, 10)),
//                         end: parseDate(weekRange.end.toISOString().slice(0, 10)),
//                     }}
//                     onChange={(range) => {
//                         setWeekRange({
//                             start: new Date(range.start.toString()),
//                             end: new Date(range.end.toString())
//                         });
//                     }}
//                 />
//                 <Select
//                     selectedKeys={[selectedUser?.userID?.toString()]}
//                     onSelectionChange={(keys) => {
//                         const id = Number(Array.from(keys)[0]);
//                         const user = users.find(u => u.userID === id);
//                         setSelectedUser(user);
//                         setWeekFilter('all');
//                     }}
//                 >
//                     {users.map(u => (
//                         <SelectItem key={u.userID}>
//                             {u.userName}
//                         </SelectItem>
//                     ))}
//                 </Select>
//             </div>
//             <EmptyState title="No entries yet" sub="Submit sprint entries to see your history here" btnLabel="Log First Sprint →" onBtn={onSwitchForm} />
//         </div>
//     );

//     const sorted = [...newData].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
//     const color = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';

//     return (
//         <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
//             <div className="flex gap-3">
//                 <DateRangePicker
//                     variant="bordered"
//                     size="md"
//                     value={{
//                         start: parseDate(weekRange.start.toISOString().slice(0, 10)),
//                         end: parseDate(weekRange.end.toISOString().slice(0, 10)),
//                     }}
//                     onChange={(range) => {
//                         setWeekRange({
//                             start: new Date(range.start.toString()),
//                             end: new Date(range.end.toString())
//                         });
//                     }}
//                 />
//                 <Select
//                     selectedKeys={[selectedUser?.userID?.toString()]}
//                     onSelectionChange={(keys) => {
//                         const id = Number(Array.from(keys)[0]);
//                         const user = users.find(u => u.userID === id);
//                         setSelectedUser(user);
//                         setWeekFilter('all');
//                     }}
//                 >
//                     {users.map(u => (
//                         <SelectItem key={u.userID}>
//                             {u.userName}
//                         </SelectItem>
//                     ))}
//                 </Select>
//             </div>
//             <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4 mt-3">
//                 All Sprint Entries <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, marginLeft: 6, color: '#8a8a8a' }}>{newData.length} total</span>
//             </div>

//             <div className="bg-surface border border-border rounded-xl p-6 shadow-sm overflow-x-auto">
//                 <table className="w-full table-fixed border-collapse text-sm">
//                     <colgroup>
//                         <col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 110 }} /><col style={{ width: 180 }} />
//                         <col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} />
//                         <col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 120 }} />
//                     </colgroup>
//                     <thead>
//                         <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a8a', textAlign: 'left' }}>
//                             <th style={{ paddingBottom: 8 }}>Developer</th><th style={{ paddingBottom: 8 }}>Sprint</th><th style={{ paddingBottom: 8 }}>Week</th>
//                             <th style={{ paddingBottom: 8 }}>Jira IDs</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>SP</th>
//                             <th style={{ paddingBottom: 8, textAlign: 'center' }}>Completion</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>Utilisation</th>
//                             <th style={{ paddingBottom: 8, textAlign: 'center' }}>Efficiency</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>Bugs</th>
//                             <th style={{ paddingBottom: 8, textAlign: 'center' }}>Goals</th>

//                             {user.userID != 1 && (
//                                 <th style={{ paddingBottom: 8, textAlign: 'center' }}>Action</th>
//                             )}
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {sorted.map(e => {
//                             const goalsMet = e.goals.filter(g => g.achieved >= g.target).length;
//                             return (
//                                 <tr key={e.id} style={{ borderTop: '1px solid #eee', transition: 'background .15s' }}>
//                                     <td style={{ padding: '8px 4px' }}><div style={{ fontWeight: 600 }}>{e.name}</div></td>
//                                     <td style={{ padding: '8px 4px' }}><span style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#f5f5f5' }}>{e.sprint}</span></td>
//                                     <td style={{ padding: '8px 4px', fontSize: 12, color: '#8a8a8a', fontFamily: 'monospace' }}>{e.weekStart || ''}</td>
//                                     <td style={{ padding: '8px 4px' }}>
//                                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 160 }}>
//                                             {e.tasks.filter(t => t.jiraId).length
//                                                 ? e.tasks.filter(t => t.jiraId).map((t, i) => <span key={i} style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#ff6a1f', background: 'rgba(37,99,235,.07)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{t.jiraId}</span>)
//                                                 : <span style={{ color: '#8a8a8a', fontSize: 12 }}>—</span>}
//                                         </div>
//                                     </td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600, color: '#ff6a1f' }}>{e.completed}/{e.committed}</td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.completion) }}>{e.metrics.completion}%</span></td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.utilisation) }}>{e.metrics.utilisation}%</span></td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.efficiency) }}>{e.metrics.efficiency}/100</span></td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: e.bugs <= 1 ? '#059669' : e.bugs <= 3 ? '#d97706' : '#ff4b2b' }}>{e.bugs}</span></td>
//                                     <td style={{ textAlign: 'center', fontWeight: 600 }}>{goalsMet}/{e.goals.length}</td>
//                                     {user.userID != 1 && (
//                                         <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
//                                             <button onClick={() => onEdit(e)} style={{ border: '1px solid #e4e4e7', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent' }}>Edit</button>
//                                             <button onClick={() => onDelete(e.id)} style={{ marginLeft: 4, border: '1px solid #fecaca', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fef2f2', color: '#ff4b2b' }}>Del</button>
//                                         </td>
//                                     )}

//                                 </tr>
//                             );
//                         })}
//                     </tbody>
//                 </table>
//             </div>
//         </div>
//     );
// }

// // ─── TOAST ─────────────────────────────────────────────────────────────────────
// let _toastFn = null;
// function showToastGlobal(msg, bg) { _toastFn && _toastFn(msg, bg); }
// function Toast() {
//     const [state, setState] = useState({ msg: '', bg: '', show: false });
//     useEffect(() => {
//         _toastFn = (msg, bg) => {
//             setState({ msg, bg: bg || '', show: true });
//             setTimeout(() => setState(s => ({ ...s, show: false })), 2800);
//         };
//     }, []);
//     return (
//         <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-white z-[9999] transition-all duration-300 ${state.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}`}
//             style={{ background: state.bg || '#0b0b0b', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
//             <span className="text-lg">{state.msg.slice(0, 2)}</span>
//             <span>{state.msg.slice(2)}</span>
//         </div>
//     );
// }

// // ─── MAIN APP ──────────────────────────────────────────────────────────────────
// export default function WeeklyPulse() {
//     const userStr = localStorage.getItem('authUserLD');
//     const user = userStr ? JSON.parse(userStr) : null;
//     const [tab, setTab] = useState(user.userID == 1 ? 'history' : 'form'); // admin sees history first, devs see form
//     const [entries, setEntries] = useState([]);
//     const [editEntry, setEditEntry] = useState(null);

//     const now = new Date();
//     const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
//     const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
//     const fmt = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
//     const weekChip = `Week ${getWeekNum(now)} · ${fmt(weekStart)} – ${fmt(weekEnd)}`;

//     // ── Transform entry → API payload ────────────────────────────────────────
//     function transformEntry(item) {

//         return {
//             userId: user?.userID,
//             sprintLabel: item.sprint,
//             weekStart: item.weekStart,
//             weekEnd: item.weekEnd,
//             daysPresent: item.days,
//             spCommitted: item.committed,
//             spCompleted: item.completed,
//             bugsIntroduced: item.bugs,
//             prReviews: item.reviews,
//             spCarryover: item.carryover,
//             blockers: item.blockers,
//             selfRating: item.selfRating,
//             achievements: item.achievements || '',
//             challenges: item.challenges || '',
//             nextFocus: item.nextFocus || '',
//             tasks: item.tasks.map((t, i) => ({
//                 jiraId: t.jiraId,
//                 taskName: t.name,
//                 storyPoints: t.sp,
//                 product: t.product?.toUpperCase().replace(/ /g, '_'),
//                 module: (t.module || "")
//                     .toUpperCase()
//                     .replace(/[ /]+/g, "_"),
//                 taskType: t.type?.toUpperCase().replace(/ /g, '_'),
//                 status: t.status?.toUpperCase(),
//                 sortOrder: i + 1,
//             })),
//             goals: item.goals.map((g, i) => ({
//                 goalName: g.name,
//                 targetPct: g.target,
//                 achievedPct: g.achieved,
//                 sortOrder: i + 1,
//             })),
//         };
//     }

//     // ── POST (create) ─────────────────────────────────────────────────────────
//     async function createEntry(entry) {
//         const payload = transformEntry(entry);
//         await axios.post('t2.0/authentificationUtilization/createSprintEntry', payload, {
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }

//     // ── PUT (update) — uses ?id=<entryId> ────────────────────────────────────
//     async function updateEntry(entry) {
//         const payload = transformEntry(entry);
//         await axios.put(
//             `t2.0/authentificationUtilization/${entry.id}`,
//             payload,
//             { headers: { 'Content-Type': 'application/json' } }
//         );
//     }

//     async function handleSubmit(entry) {
//         const isEdit = !!editEntry;   // true  → PUT,  false → POST
//         try {
//             if (isEdit) {
//                 await updateEntry(entry);
//                 showToastGlobal('✅ Sprint entry updated!');
//             } else {
//                 await createEntry(entry);
//                 showToastGlobal('✅ Sprint entry saved successfully!');
//             }
//             // keep local state in sync
//             setEntries(prev => {
//                 const idx = prev.findIndex(e => e.id === entry.id);
//                 return idx >= 0 ? prev.map((e, i) => i === idx ? entry : e) : [...prev, entry];
//             });
//             setEditEntry(null);
//             setTimeout(() => setTab('dashboard'), 900);
//         } catch (err) {
//             console.error('Save error:', err);
//             showToastGlobal('❌ Failed to save entry', '#ff4b2b');
//         }
//     }

//     // function handleDelete(id) {
//     //     if (!confirm('Delete this sprint entry?')) return;
//     //     setEntries(prev => prev.filter(e => e.id !== id));
//     //     showToastGlobal('🗑 Entry deleted');
//     // }
//     const handleDelete = async (id) => {
//         try {

//             await axios.delete(
//                 `/t2.0/authentificationUtilization/${id}`
//             );

//             // update UI
//             setEntries(prev => prev.filter(e => e.id !== id));


//         } catch (err) {
//             console.error("Delete failed:", err);
//         }
//     };

//     function handleEdit(entry) {
//         setEditEntry(entry);
//         setTab('form');
//     }

//     return (
//         <div className="relative min-h-screen isolate text-ink-900 dark:text-white">
//             <style>{GLOBAL_STYLE}</style>
//             <header className="px-10 flex items-center justify-between h-16">
//                 <Tabs
//                     className="wp-tabs"
//                     selectedKey={tab}
//                     onSelectionChange={key => setTab(String(key))}
//                     variant="light"
//                     aria-label="WeeklyPulse navigation"
//                     disableAnimation={false}
//                 >
//                     <>
//                         {user.userID !== 1 && (
//                             <Tab key="form" title="Log Sprint" />
//                         )}

//                         <Tab key="dashboard" title="Dashboard" />
//                         <Tab key="history" title="History" />
//                     </>
//                 </Tabs>
//             </header>

//             {tab === 'form' && (
//                 <FormTab
//                     key={editEntry?.id ?? 'new'}
//                     initialEntry={editEntry}
//                     onSubmit={entry => { handleSubmit(entry); }}
//                     onSwitchDashboard={() => { setEditEntry(null); setTab('dashboard'); }}
//                 />
//             )}
//             {tab === 'dashboard' && <DashboardTab entries={entries} onSwitchForm={() => setTab('form')} />}
//             {tab === 'history' && <HistoryTab entries={entries} onDelete={handleDelete} onEdit={handleEdit} onSwitchForm={() => setTab('form')} />}

//             <Toast />
//         </div>
//     );
// }


import { useState, useEffect, useRef } from "react";
import { Tabs, Tab, Input, Select, SelectItem } from "@/components/ui";
import axios from "axios";
import { DateRangePicker } from "@/components/ui";
import { parseDate } from "@internationalized/date";

// ─── CSS ───────────────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  .wp-root::before {
    content:'';position:absolute;inset:0;pointer-events:none;z-index:999;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    opacity:.4;
  }
  .wp-bar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
    background:#0b0b0b;color:#fff;font-size:10px;padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:10;}
  .wp-section-title::after{content:'';flex:1;height:1px;background:#e4e4e7;}
  .wp-kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--kpi-color,#ff6a1f);}
  .wp-textarea{resize:vertical;min-height:72px;line-height:1.5;width:100%;border:1.5px solid #d4d4d8;border-radius:8px;padding:10px 14px;font-size:14px;color:#0b0b0b;outline:none;transition:.15s;}
  .wp-textarea:focus{border-color:#ff6a1f;background:#fff;box-shadow:0 0 0 3px rgba(232,83,10,.1);}
  .wp-tabs [data-slot="tabList"]{background:transparent!important;padding:0!important;gap:4px!important;border-radius:0!important;}
  .wp-tabs [data-slot="tab"]{padding:7px 18px!important;border-radius:6px!important;font-size:13px!important;font-weight:600!important;color:#8a8a8a!important;background:transparent!important;transition:background .15s,color .15s!important;height:auto!important;min-height:0!important;}
  .wp-tabs [data-slot="tab"]:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;}
  .wp-tabs [aria-selected="true"][data-slot="tab"],.wp-tabs [data-selected="true"][data-slot="tab"]{background:#ff6a1f!important;color:#fff!important;}
  .wp-tabs [data-slot="tabContent"]{font-size:13px!important;font-weight:600!important;}
  .wp-tabs [data-slot="cursor"]{display:none!important;}
  .wp-tabs [data-slot="panel"]{padding:0!important;outline:none!important;}
`;

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const PRODUCTS = ['TapMind SDK', 'Display Ad Server', 'Video Ad Server', 'Hads Server', 'Proxy Server', 'AdCache', 'Mediation Adapter', 'Publisher Dashboard', 'Internal Tools', 'Other'];
const MODULES = ['Android SDK', 'iOS SDK', 'Web SDK', 'Ad Refresh', 'Mediation', 'oRTB / Demand', 'GAM / AdMob', 'Unity LevelPlay', 'MAX (AppLovin)', 'Backend API', 'Pipeline / Kafka', 'Aerospike', 'ClickHouse', 'DevOps / Infra', 'Docs / QA', 'Other'];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function getWeekNum(d) {
    const s = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
}
function calcMetrics(committed, completed, days, bugs, selfRating) {
    committed = parseFloat(committed) || 0;
    completed = parseFloat(completed) || 0;
    days = parseFloat(days) || 0;
    bugs = parseFloat(bugs) || 0;
    selfRating = parseFloat(selfRating) || 0;
    const completion = committed > 0 ? Math.round((completed / committed) * 100) : 0;
    const utilisation = Math.round((days / 5) * 100);
    const qualityScore = Math.max(0, Math.min(100, 100 - bugs * 15));
    const efficiency = Math.round(completion * 0.4 + utilisation * 0.35 + qualityScore * 0.25);
    const overall = Math.round(efficiency * 0.6 + (selfRating * 10) * 0.4);
    return { completion, utilisation, qualityScore, efficiency, overall };
}
function metricColor(v) {
    return v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
}
function trendIcon(v) { return v >= 85 ? '▲' : v >= 65 ? '●' : '▼'; }

// ─── RADAR SVG ─────────────────────────────────────────────────────────────────
function buildRadar(values, labels, colors) {
    const cx = 100, cy = 100, r = 72, n = values.length;
    const a = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const pt = (i, rad) => [cx + rad * Math.cos(a(i)), cy + rad * Math.sin(a(i))];
    let h = '';
    [.25, .5, .75, 1].forEach(f => {
        const pts = Array.from({ length: n }, (_, i) => pt(i, r * f)).map(p => p.join(',')).join(' ');
        h += `<polygon points="${pts}" fill="none" stroke="#e4e4e7" stroke-width="1"/>`;
    });
    for (let i = 0; i < n; i++) { const [x, y] = pt(i, r); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e4e4e7" stroke-width="1"/>`; }
    const dpts = values.map((v, i) => pt(i, r * (v / 100))).map(p => p.join(',')).join(' ');
    h += `<polygon points="${dpts}" fill="rgba(37,99,235,.12)" stroke="#ff6a1f" stroke-width="2"/>`;
    values.forEach((v, i) => { const [x, y] = pt(i, r * (v / 100)); h += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[i]}" stroke="#fff" stroke-width="2"/>`; });
    for (let i = 0; i < n; i++) {
        const [x, y] = pt(i, r + 16);
        const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
        h += `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#8a8a8a" font-size="9" font-weight="700">${labels[i].toUpperCase()}</text>`;
    }
    return h;
}

// ─── JIRA CSV IMPORT ───────────────────────────────────────────────────────────
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') { field += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { field += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field.trim()); field = ''; }
            else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                row.push(field.trim());
                if (row.some(c => c !== '')) rows.push(row);
                row = []; field = '';
                if (ch === '\r') i++;
            } else { field += ch; }
        }
    }
    if (field || row.length) { row.push(field.trim()); rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.replace(/^\uFEFF/, ''));
    return rows.slice(1).map(cells => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
        return obj;
    });
}

function mapIssueTypeToTaskType(issueType = '') {
    const t = issueType.toLowerCase();
    if (t === 'bug') return 'Bug';
    if (['epic', 'story', 'task', 'subtask', 'sub-task'].includes(t)) return 'Feature';
    return 'Research';
}

function mapStatusToTaskStatus(status = '') {
    const s = status.toLowerCase();
    if (['done', 'resolved', 'closed', 'complete', 'completed'].some(k => s.includes(k))) return 'done';
    if (['in progress', 'in review', 'review', 'testing', 'in development'].some(k => s.includes(k))) return 'partial';
    if (['to do', 'open', 'backlog', 'new', 'todo'].some(k => s.includes(k))) return 'carry';
    return 'missed';
}

function parseJiraCsv(csvText, startId = 1000) {
    const rows = parseCSV(csvText);
    const tasks = [];
    let id = startId;
    for (const row of rows) {
        const jiraId = (row['Issue key'] || '').trim();
        const name = (row['Summary'] || '').trim();
        const sp = (row['Custom field (Story point estimate)'] || '').trim();
        const issueType = (row['Issue Type'] || '').trim();
        const status = (row['Status'] || '').trim();
        if (!jiraId && !name) continue;
        tasks.push({
            id: id++,
            jiraId: jiraId.toUpperCase(),
            name,
            sp: sp || '',
            product: 'Other',
            module: 'Other',
            type: mapIssueTypeToTaskType(issueType),
            status: mapStatusToTaskStatus(status),
        });
    }
    return tasks;
}

// ─── JIRA CSV IMPORT BUTTON ────────────────────────────────────────────────────
function JiraCsvImportBtn({ onImport, nextId }) {
    const fileRef = useRef(null);
    const [importStatus, setImportStatus] = useState(''); // '', 'ok', 'err'
    const [importCount, setImportCount] = useState(0);

    function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            setImportStatus('err'); setImportCount(0); e.target.value = ''; return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const startId = nextId ? nextId.current : Date.now();
                const tasks = parseJiraCsv(ev.target.result, startId);
                if (nextId) nextId.current += tasks.length;
                if (tasks.length === 0) throw new Error('No tasks found');
                onImport(tasks);
                setImportStatus('ok');
                setImportCount(tasks.length);
            } catch {
                setImportStatus('err'); setImportCount(0);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
            <button
                onClick={() => { setImportStatus(''); fileRef.current?.click(); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px',
                    background: 'transparent',
                    border: '1.5px dashed #ff6a1f',
                    borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    color: '#ff6a1f',
                    cursor: 'pointer',
                    transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,.06)'; e.currentTarget.style.borderColor = '#ff6a1f'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ff6a1f'; }}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M11.75 2L2 11.75l4.5 4.5L11.75 11l5.25 5.25 4.5-4.5L11.75 2z" fill="currentColor" opacity=".9" />
                    <path d="M11.75 22l9.75-9.75-4.5-4.5L11.75 13l-5.25-5.25-4.5 4.5L11.75 22z" fill="currentColor" opacity=".5" />
                </svg>
                Import Jira CSV
            </button>
            {importStatus === 'ok' && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', background: 'rgba(22,163,74,.09)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 20, padding: '3px 12px' }}>
                    ✓ {importCount} task{importCount !== 1 ? 's' : ''} imported
                </span>
            )}
            {importStatus === 'err' && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#ff4b2b', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 20, padding: '3px 12px' }}>
                    ✗ Invalid CSV or no tasks found
                </span>
            )}
        </div>
    );
}

// ─── EMPTY STATE ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, btnLabel, onBtn }) {
    return (
        <div className="text-center py-16 px-5 flex flex-col items-center gap-3.5">
            <div className="text-5xl opacity-30">{icon}</div>
            <div className="text-lg font-bold text-ink-500 dark:text-ink-400">{title}</div>
            <div className="text-sm text-ink-400">{sub}</div>
            <button onClick={onBtn} className="mt-1.5 px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-[9px] cursor-pointer border-none hover:bg-brand-700 transition-all">
                {btnLabel}
            </button>
        </div>
    );
}

// ─── TASK ROW COMPONENT ────────────────────────────────────────────────────────
function TaskRowInput({ task, onChange, onRemove }) {
    const TASK_TYPES = ['Feature', 'Bug', 'Refactor', 'Test', 'Docs', 'Review', 'Infra', 'Research'];
    const TASK_STATUSES = [{ key: 'done', label: 'Done' }, { key: 'partial', label: 'Partial' }, { key: 'missed', label: 'Missed' }, { key: 'carry', label: 'Carry' }];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '90px 2fr 80px 1fr 1fr 1.5fr 36px', gap: 10, alignItems: 'center' }} className="border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5 transition-all">
            <Input size="sm" placeholder="TP-50" label="Jira ID" labelPlacement="outside"
                value={task.jiraId || ''} onValueChange={v => onChange('jiraId', v.toUpperCase())}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <Input size="sm" placeholder="e.g. Fix AdMob adapter crash" label="Task Name" labelPlacement="outside"
                value={task.name || ''} onValueChange={v => onChange('name', v)}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <Input size="sm" type="number" placeholder="3" label="SP" labelPlacement="outside"
                value={task.sp || ''} onValueChange={v => onChange('sp', v)}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <Select size="sm" label="Product" labelPlacement="outside"
                selectedKeys={[task.product || PRODUCTS[0]]} onSelectionChange={keys => onChange('product', Array.from(keys)[0])}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
                {PRODUCTS.map(p => <SelectItem key={p}>{p}</SelectItem>)}
            </Select>
            <Select size="sm" label="Module" labelPlacement="outside"
                selectedKeys={[task.module || MODULES[0]]} onSelectionChange={keys => onChange('module', Array.from(keys)[0])}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }}>
                {MODULES.map(m => <SelectItem key={m}>{m}</SelectItem>)}
            </Select>
            <div className="flex flex-col gap-1">
                <div className="text-[10px] font-bold tracking-wide uppercase text-ink-400">Type &amp; Status</div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <Select size="sm" aria-label="Type"
                        selectedKeys={[task.type || 'Feature']} onSelectionChange={keys => onChange('type', Array.from(keys)[0])}
                        style={{ flex: 1 }}>
                        {TASK_TYPES.map(t => <SelectItem key={t}>{t}</SelectItem>)}
                    </Select>
                    <Select size="sm" aria-label="Status"
                        selectedKeys={[task.status || 'done']} onSelectionChange={keys => onChange('status', Array.from(keys)[0])}
                        style={{ flex: 1 }}>
                        {TASK_STATUSES.map(s => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                    </Select>
                </div>
            </div>
            <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">×</button>
        </div>
    );
}

// ─── GOAL ROW COMPONENT ────────────────────────────────────────────────────────
function GoalRowInput({ goal, onChange, onRemove }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 36px', gap: 10, alignItems: 'center' }} className="border border-ink-200 dark:border-white/10 rounded-[10px] px-3.5 py-2.5">
            <Input size="sm" placeholder="e.g. Zero crashes in prod" label="Goal Description" labelPlacement="outside"
                value={goal.name || ''} onValueChange={v => onChange('name', v)}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <Input size="sm" type="number" placeholder="100" label="Target %" labelPlacement="outside"
                value={goal.target || ''} onValueChange={v => onChange('target', v)}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <Input size="sm" type="number" placeholder="85" label="Achieved %" labelPlacement="outside"
                value={goal.achieved || ''} onValueChange={v => onChange('achieved', v)}
                classNames={{ label: 'text-[10px] font-bold tracking-widest uppercase text-ink-400' }} />
            <button onClick={onRemove} className="w-7 h-7 rounded-md border border-ink-300 dark:border-white/15 bg-transparent text-ink-400 cursor-pointer text-[15px] flex items-center justify-center transition-all hover:bg-rose-600 hover:border-rose-600 hover:text-white">×</button>
        </div>
    );
}

// ─── FORM FIELD ────────────────────────────────────────────────────────────────
function FormGroup({ label, hint, children, full, half }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1/-1' : half ? 'span 2' : undefined }}>
            <label className="text-[11px] font-bold tracking-[1.2px] uppercase text-ink-500 dark:text-ink-400">
                {label}{hint && <span className="text-[10px] font-normal text-ink-400 tracking-normal ml-1.5 normal-case">{hint}</span>}
            </label>
            {children}
        </div>
    );
}

function AddBtn({ onClick, children }) {
    return (
        <button onClick={onClick}
            className="mt-2.5 px-4 py-2 bg-transparent border-[1.5px] border-dashed border-ink-300 dark:border-white/15 rounded-lg text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer flex items-center gap-2 transition-all hover:border-brand-600 hover:text-brand-600 hover:bg-[rgba(232,83,10,.04)]">
            {children}
        </button>
    );
}

// ─── FORM TAB ──────────────────────────────────────────────────────────────────
function FormTab({ initialEntry, onSubmit, onSwitchDashboard }) {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
    const fmt = d => d.toISOString().slice(0, 10);

    const isEdit = !!initialEntry;
    const userStr = localStorage.getItem('authUserLD');
    const user = userStr ? JSON.parse(userStr) : null;

    const [f, setF] = useState(() => {
        if (initialEntry) {
            return {
                name: user?.name || '',
                role: initialEntry.role || '',
                sprint: initialEntry.sprint || `W-${getWeekNum(now)}`,
                weekStart: initialEntry.weekStart || fmt(weekStart),
                weekEnd: initialEntry.weekEnd || fmt(weekEnd),
                days: String(initialEntry.days ?? ''),
                committed: String(initialEntry.committed ?? ''),
                completed: String(initialEntry.completed ?? ''),
                bugs: String(initialEntry.bugs ?? ''),
                reviews: String(initialEntry.reviews ?? ''),
                carryover: String(initialEntry.carryover ?? ''),
                blockers: String(initialEntry.blockers ?? ''),
                selfRating: String(initialEntry.selfRating ?? ''),
                achievements: initialEntry.achievements || '',
                challenges: initialEntry.challenges || '',
                nextFocus: initialEntry.nextFocus || '',
            };
        }
        return {
            name: user?.name || '', role: '', sprint: `W-${getWeekNum(now)}`,
            weekStart: fmt(weekStart), weekEnd: fmt(weekEnd),
            days: '', committed: '', completed: '', bugs: '',
            reviews: '', carryover: '', blockers: '', selfRating: '',
            achievements: '', challenges: '', nextFocus: '',
        };
    });

    const taskId = useRef(100);
    const goalId = useRef(100);

    const [tasks, setTasks] = useState(() => {
        if (initialEntry?.tasks?.length) {
            return initialEntry.tasks.map((t, i) => ({
                id: 100 + i,
                jiraId: t.jiraId || '',
                name: t.name || '',
                sp: String(t.sp ?? ''),
                product: t.product || PRODUCTS[0],
                module: t.module || MODULES[0],
                type: t.type || 'Feature',
                status: t.status || 'done',
            }));
        }
        return [];
    });

    const [goals, setGoals] = useState(() => {
        if (initialEntry?.goals?.length) {
            return initialEntry.goals.map((g, i) => ({
                id: 200 + i,
                name: g.name || '',
                target: String(g.target ?? ''),
                achieved: String(g.achieved ?? ''),
            }));
        }
        return [];
    });

    const live = (f.committed || f.completed) ? calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating) : null;
    const lc = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';
    const ll = v => v >= 85 ? '▲ On Target' : v >= 65 ? '● Moderate' : '▼ Below';

    function addTask() { const id = taskId.current++; setTasks(t => [...t, { id, jiraId: '', name: '', sp: '', product: PRODUCTS[0], module: MODULES[0], type: 'Feature', status: 'done' }]); }
    function removeTask(id) { setTasks(t => t.filter(x => x.id !== id)); }
    function updateTask(id, key, val) { setTasks(t => t.map(x => x.id === id ? { ...x, [key]: val } : x)); }
    function addGoal() { const id = goalId.current++; setGoals(g => [...g, { id, name: '', target: '', achieved: '' }]); }
    function removeGoal(id) { setGoals(g => g.filter(x => x.id !== id)); }
    function updateGoal(id, key, val) { setGoals(g => g.map(x => x.id === id ? { ...x, [key]: val } : x)); }

    // ── Jira CSV import handler ──────────────────────────────────────────────
    function handleJiraImport(imported) {
        setTasks(prev => {
            const existingIds = new Set(prev.map(t => t.jiraId).filter(Boolean));
            const deduped = imported.filter(t => !existingIds.has(t.jiraId));
            return [...prev, ...deduped];
        });
    }

    function handleSubmit() {
        if (!f.name.trim()) { showToastGlobal('⚠️ Please enter your name!', '#ff6a1f'); return; }
        if (!f.sprint.trim()) { showToastGlobal('⚠️ Please enter the sprint/week label!', '#ff6a1f'); return; }
        const metrics = calcMetrics(f.committed, f.completed, f.days, f.bugs, f.selfRating);
        const entry = {
            id: initialEntry?.id ?? Date.now(),
            ...f,
            committed: parseFloat(f.committed) || 0,
            completed: parseFloat(f.completed) || 0,
            days: parseFloat(f.days) || 5,
            bugs: parseFloat(f.bugs) || 0,
            reviews: parseFloat(f.reviews) || 0,
            carryover: parseFloat(f.carryover) || 0,
            blockers: parseFloat(f.blockers) || 0,
            selfRating: parseFloat(f.selfRating) || 0,
            metrics,
            tasks: tasks.filter(t => t.name).map(t => ({ ...t, sp: parseFloat(t.sp) || 0 })),
            goals: goals.filter(g => g.name).map(g => ({ ...g, target: parseFloat(g.target) || 100, achieved: parseFloat(g.achieved) || 0 })),
            timestamp: initialEntry?.timestamp ?? new Date().toISOString(),
            managerNote: initialEntry?.managerNote ?? '',
        };
        onSubmit(entry);
    }

    function handleReset() {
        setF({ name: '', role: '', sprint: `W-${getWeekNum(now)}`, weekStart: fmt(weekStart), weekEnd: fmt(weekEnd), days: '', committed: '', completed: '', bugs: '', reviews: '', carryover: '', blockers: '', selfRating: '', achievements: '', challenges: '', nextFocus: '' });
        setTasks([]);
        setGoals([]);
    }

    const inp = (id, extra = {}) => ({ value: f[id], onChange: e => setF(p => ({ ...p, [id]: e.target.value })), ...extra });

    return (
        <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', overflow: 'hidden', marginBottom: 28 }}>
                {/* Header */}
                <div style={{ padding: '24px 30px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0b0b0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isEdit ? 'Edit Sprint Entry' : 'Weekly Sprint Entry'}
                            {isEdit && (
                                <span style={{ fontSize: 12, fontWeight: 700, background: '#fff3e0', color: '#ff6a1f', border: '1px solid #fdd8b5', borderRadius: 20, padding: '2px 10px', letterSpacing: 1 }}>
                                    EDITING · {initialEntry.sprint}
                                </span>
                            )}
                        </h2>
                        <p style={{ fontSize: 13, color: '#8a8a8a' }}>
                            {isEdit ? 'Update your sprint details — changes will be saved via PUT' : 'Fill in your sprint details — all metrics are calculated automatically'}
                        </p>
                    </div>
                </div>

                <div style={{ padding: '28px 30px' }}>
                    {/* Identity */}
                    <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Developer Identity</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
                        <FormGroup label="Full Name">
                            <Input variant="bordered" size="sm" placeholder="e.g. name" {...inp('name')} onValueChange={v => setF(p => ({ ...p, name: v }))} />
                        </FormGroup>
                        <FormGroup label="Role / Team">
                            <Input variant="bordered" size="sm" placeholder="e.g. Engineer" {...inp('role')} onValueChange={v => setF(p => ({ ...p, role: v }))} />
                        </FormGroup>
                        <FormGroup label="Sprint / Week Label">
                            <Input variant="bordered" size="sm" placeholder="e.g. W-24 / Sprint 20" {...inp('sprint')} onValueChange={v => setF(p => ({ ...p, sprint: v }))} />
                        </FormGroup>
                        <FormGroup label="Week Range">
                            <DateRangePicker
                                variant="bordered"
                                size="sm"
                                value={
                                    f.weekStart && f.weekEnd
                                        ? { start: parseDate(f.weekStart), end: parseDate(f.weekEnd) }
                                        : null
                                }
                                onChange={(range) => {
                                    setF(p => ({
                                        ...p,
                                        weekStart: range?.start?.toString() || '',
                                        weekEnd: range?.end?.toString() || '',
                                    }));
                                }}
                            />
                        </FormGroup>
                        <FormGroup label="Days Present" hint="(out of 5)">
                            <Input variant="bordered" size="sm" type="number" placeholder="5" {...inp('days')} onValueChange={v => setF(p => ({ ...p, days: v }))} />
                        </FormGroup>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

                    {/* Story Points */}
                    <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Story Points</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
                        <FormGroup label="Story Points Committed">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 20" {...inp('committed')} onValueChange={v => setF(p => ({ ...p, committed: v }))} />
                        </FormGroup>
                        <FormGroup label="Story Points Completed">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 17" {...inp('completed')} onValueChange={v => setF(p => ({ ...p, completed: v }))} />
                        </FormGroup>
                        <FormGroup label="Bugs Introduced">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 2" {...inp('bugs')} onValueChange={v => setF(p => ({ ...p, bugs: v }))} />
                        </FormGroup>
                        <FormGroup label="PRs / Code Reviews Done">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 4" {...inp('reviews')} onValueChange={v => setF(p => ({ ...p, reviews: v }))} />
                        </FormGroup>
                        <FormGroup label="Carry-over SP from last week">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 3" {...inp('carryover')} onValueChange={v => setF(p => ({ ...p, carryover: v }))} />
                        </FormGroup>
                        <FormGroup label="Blockers Encountered">
                            <Input variant="bordered" size="sm" type="number" placeholder="e.g. 1" {...inp('blockers')} onValueChange={v => setF(p => ({ ...p, blockers: v }))} />
                        </FormGroup>
                    </div>

                    {/* Live Preview */}
                    {live && (
                        <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 12 }}>⚡ Live Auto-Calculation</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                                {[
                                    { k: 'Completion Rate', v: live.completion + '%', c: lc(live.completion), l: ll(live.completion) },
                                    { k: 'Utilisation', v: live.utilisation + '%', c: lc(live.utilisation), l: ll(live.utilisation) },
                                    { k: 'Quality Score', v: live.qualityScore + '/100', c: lc(live.qualityScore), l: ll(live.qualityScore) },
                                    { k: 'Efficiency Score', v: live.efficiency + '/100', c: lc(live.efficiency), l: ll(live.efficiency) },
                                ].map(m => (
                                    <div key={m.k} style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>{m.k}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
                                        <div style={{ fontSize: 11, color: m.c, marginTop: 4, fontWeight: 600 }}>{m.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

                    {/* Tasks */}
                    <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Tasks Worked This Week</div>

                    {/* ── Jira CSV import info banner ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(99,102,241,.04)', border: '1px solid rgba(99,102,241,.18)',
                        borderRadius: 10, padding: '10px 16px', marginBottom: 14,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M11.75 2L2 11.75l4.5 4.5L11.75 11l5.25 5.25 4.5-4.5L11.75 2z" fill="#ff6a1f" opacity=".9" />
                                <path d="M11.75 22l9.75-9.75-4.5-4.5L11.75 13l-5.25-5.25-4.5 4.5L11.75 22z" fill="#ff6a1f" opacity=".5" />
                            </svg>
                            <span style={{ fontSize: 12, color: '#ff6a1f', fontWeight: 600 }}>
                                Have a Jira export? Import your tasks directly from a CSV file.
                            </span>
                            <span style={{ fontSize: 11, color: '#8a8a8a' }}>
                                Maps: Issue Key → Jira ID · Summary → Task Name · Story Points · Issue Type → Type · Status
                            </span>
                        </div>
                        <JiraCsvImportBtn nextId={taskId} onImport={handleJiraImport} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                        {tasks.map(t => (
                            <TaskRowInput key={t.id} task={t} onChange={(k, v) => updateTask(t.id, k, v)} onRemove={() => removeTask(t.id)} />
                        ))}
                    </div>
                    <AddBtn onClick={addTask}>＋ Add Task</AddBtn>

                    <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

                    {/* Goals */}
                    <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">
                        Weekly Goals <span style={{ fontSize: 10, color: '#8a8a8a', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>Set targets and track what you achieved</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        {goals.map(g => (
                            <GoalRowInput key={g.id} goal={g} onChange={(k, v) => updateGoal(g.id, k, v)} onRemove={() => removeGoal(g.id)} />
                        ))}
                    </div>
                    <AddBtn onClick={addGoal}>＋ Add Goal</AddBtn>

                    <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />

                    {/* Reflection */}
                    <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">Self Reflection</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
                        <FormGroup label="Key Achievements This Week" full>
                            <textarea className="wp-textarea" placeholder="What did you accomplish? What are you proud of?" {...inp('achievements')} />
                        </FormGroup>
                        <FormGroup label="Blockers / Challenges" full>
                            <textarea className="wp-textarea" placeholder="What slowed you down? What do you need help with?" {...inp('challenges')} />
                        </FormGroup>
                        <FormGroup label="Focus Area Next Week" half>
                            <textarea className="wp-textarea" placeholder="What is your top priority next sprint?" style={{ minHeight: 54 }} {...inp('nextFocus')} />
                        </FormGroup>
                        <FormGroup label="Confidence Score" hint="(1–10)">
                            <Input variant="bordered" size="sm" type="number" placeholder="7" {...inp('selfRating')} onValueChange={v => setF(p => ({ ...p, selfRating: v }))} />
                        </FormGroup>
                    </div>

                    {/* Submit Row */}
                    <div className="flex items-center gap-3.5 mt-6">
                        <button onClick={handleSubmit}
                            className="flex items-center gap-2.5 px-8 py-3 text-white text-[15px] font-bold rounded-[10px] cursor-pointer transition-all border-none"
                            style={{ background: isEdit ? '#0b0b0b' : '#ff6a1f' }}
                        >
                            <span>{isEdit ? 'Save Changes' : 'Submit Sprint Entry'}</span>
                            <span>{isEdit ? '✓' : '→'}</span>
                        </button>
                        <button onClick={handleReset} className="px-5 py-3 bg-transparent border-[1.5px] border-ink-300 dark:border-white/15 rounded-[10px] text-sm font-semibold text-ink-500 dark:text-ink-400 cursor-pointer transition-all">
                            Reset
                        </button>
                        {isEdit && (
                            <button onClick={onSwitchDashboard} className="px-5 py-3 bg-transparent border-[1.5px] border-ink-300 dark:border-white/15 rounded-[10px] text-sm font-semibold text-ink-400 cursor-pointer transition-all">
                                Cancel
                            </button>
                        )}
                        <span className="text-xs text-ink-400 ml-auto">
                            {isEdit ? `Editing entry ID: ${initialEntry.id}` : 'All fields with auto-calc will update your dashboard instantly'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── mapApiItem ────────────────────────────────────────────────────────────────
function mapApiItem(item) {
    return {
        id: item.id,
        name: item.userName,
        role: item.userEmail || '',
        sprint: item.sprintLabel,
        weekStart: item.weekStart,
        weekEnd: item.weekEnd,
        days: item.daysPresent,
        committed: item.spCommitted,
        completed: item.spCompleted,
        bugs: item.bugsIntroduced,
        reviews: item.prReviews,
        carryover: item.spCarryover,
        blockers: item.blockers,
        selfRating: item.selfRating,
        achievements: item.achievements || '',
        challenges: item.challenges || '',
        nextFocus: item.nextFocus || '',
        managerNote: item.managerNote || '',
        timestamp: item.entryTimestamp,
        metrics: {
            completion: item.scoreCompletion,
            utilisation: item.scoreUtilisation,
            qualityScore: item.scoreQuality,
            efficiency: item.scoreEfficiency,
            overall: item.scoreOverall,
        },
        radarFromApi: item.radar,
        tasks: (item.tasks || []).map(t => ({
            id: t.id,
            jiraId: t.jiraId,
            name: t.taskName,
            sp: t.storyPoints,
            product: t.product,
            module: t.module,
            type: t.taskType,
            status: t.status?.toLowerCase(),
        })),
        goals: (item.goals || []).map(g => ({
            name: g.goalName,
            target: g.targetPct,
            achieved: g.achievedPct,
        })),
    };
}

// ─── DASHBOARD TAB ─────────────────────────────────────────────────────────────
function DashboardTab({ entries, onSwitchForm }) {
    const authUserLD = localStorage.getItem("authUserLD");
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = { filter: "", searchText: "", departmentID: 24 };
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    body,
                    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}` } }
                );
                const usersData = res.data.response.users || [];
                const formatted = usersData.map(u => ({ userID: u.userID, userName: u.userName }));
                setUsers(formatted);
                if (formatted.length > 0) setSelectedUser(formatted[0]);
            } catch (err) { console.error("Error fetching users:", err); }
        };
        fetchUsers();
    }, []);

    const [dashDev, setDashDev] = useState(null);
    const [weekFilter, setWeekFilter] = useState('all');
    const [managerNote, setManagerNote] = useState('');
    const [newData, setNewData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weekRange, setWeekRange] = useState(() => {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
        const end = new Date(start); end.setDate(start.getDate() + 4);
        return { start, end };
    });

    const displayEntries = newData.length ? newData : entries;
    const sprints = [...new Set(displayEntries.map(e => e.sprint))].sort();
    const selectedDev = dashDev || (displayEntries.length ? displayEntries[displayEntries.length - 1].name : null);
    const devEntries = displayEntries.filter(e => e.name === selectedDev).sort((a, b) => a.sprint.localeCompare(b.sprint));
    const cur = weekFilter === 'all' ? devEntries[devEntries.length - 1] : (devEntries.find(e => e.sprint === weekFilter) || devEntries[devEntries.length - 1]);

    useEffect(() => {
        const fetchEntries = async () => {
            try {
                setLoading(true);
                const result = await axios.get(
                    `t2.0/authentificationUtilization/getSprintEntry?userId=${selectedUser?.userID}&from=${weekRange.start.toISOString().slice(0, 10)}&to=${weekRange.end.toISOString().slice(0, 10)}`
                );
                const mapped = result.data.data.content.map(mapApiItem);
                setNewData(mapped);
            } catch (e) { console.error('Error fetching entries:', e); }
            finally { setLoading(false); }
        };
        fetchEntries();
    }, [weekRange, selectedUser]);

    useEffect(() => { setManagerNote(cur?.managerNote || ''); }, [cur?.id]);

    if (loading) return <div style={{ margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: 14 }}>Loading dashboard...</div>;

    if (!displayEntries.length) return (
        <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
            <div className="flex gap-3 mb-4">
                <DateRangePicker variant="bordered" size="md"
                    value={{ start: parseDate(weekRange.start.toISOString().slice(0, 10)), end: parseDate(weekRange.end.toISOString().slice(0, 10)) }}
                    onChange={(range) => setWeekRange({ start: new Date(range.start.toString()), end: new Date(range.end.toString()) })}
                />
                <Select selectedKeys={[selectedUser?.userID?.toString()]}
                    onSelectionChange={(keys) => { const id = Number(Array.from(keys)[0]); setSelectedUser(users.find(u => u.userID === id)); setWeekFilter('all'); }}>
                    {users.map(u => <SelectItem key={u.userID}>{u.userName}</SelectItem>)}
                </Select>
            </div>
            <EmptyState title="No sprint data yet" sub="Submit your first weekly sprint entry to see your dashboard" btnLabel="Go to Sprint Entry →" onBtn={onSwitchForm} />
        </div>
    );
    if (!cur) return null;

    const m = cur.metrics;
    const goalsMet = cur.goals.filter(g => g.achieved >= g.target).length;
    const tasksTotal = cur.tasks.length;
    const tasksDone = cur.tasks.filter(t => t.status === 'done').length;
    const maxSP = Math.max(...devEntries.map(e => Math.max(e.committed, e.completed, 1)));
    const radar = cur.radarFromApi;
    const radarVals = radar
        ? [radar.utilisation, radar.velocity, radar.reviews, radar.quality, radar.goals, radar.self]
        : [m.utilisation, m.completion, Math.min(100, cur.reviews * 20), m.qualityScore, goalsMet > 0 ? Math.round((goalsMet / Math.max(cur.goals.length, 1)) * 100) : 0, Math.min(100, cur.selfRating * 10)];
    const radarLabels = ['Util', 'Velocity', 'Reviews', 'Quality', 'Goals', 'Self'];
    const radarColors = ['#ff6a1f', '#ff6a1f', '#059669', '#ff6a1f', '#d97706', '#0891b2'];
    const score = m.overall || m.efficiency;
    const scoreColor = metricColor(score);
    const scoreLabel = score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : 'NEEDS FOCUS';
    const circumference = 2 * Math.PI * 36;
    const dashOffset = circumference * (1 - score / 100);
    const statusTag = { done: { lbl: '✓ Done' }, partial: { lbl: '◑ Partial' }, missed: { lbl: '✗ Missed' }, carry: { lbl: '→ Carry' } };
    const tagStyle = { done: { background: 'rgba(22,163,74,.1)', color: '#059669' }, partial: { background: 'rgba(202,138,4,.1)', color: '#d97706' }, missed: { background: 'rgba(220,38,38,.1)', color: '#ff4b2b' }, carry: { background: 'rgba(107,114,128,.1)', color: '#6b7280' } };

    return (
        <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 30, padding: '8px 18px 8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ff6a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
                        {selectedDev?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div><div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDev}</div><div style={{ fontSize: 11, color: '#8a8a8a' }}>{cur.role || 'Developer'}</div></div>
                </div>
                <DateRangePicker variant="bordered" size="md"
                    value={{ start: parseDate(weekRange.start.toISOString().slice(0, 10)), end: parseDate(weekRange.end.toISOString().slice(0, 10)) }}
                    onChange={(range) => setWeekRange({ start: new Date(range.start.toString()), end: new Date(range.end.toString()) })}
                />
                <div className="w-80">
                    <Select className="w-full" size="md"
                        selectedKeys={[selectedUser?.userID?.toString()]}
                        onSelectionChange={(keys) => { const id = Number(Array.from(keys)[0]); setSelectedUser(users.find(u => u.userID === id)); setWeekFilter('all'); }}>
                        {users.map(u => <SelectItem key={u.userID}>{u.userName}</SelectItem>)}
                    </Select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#8a8a8a', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Filter by Week</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['all', ...sprints].map(s => (
                            <button key={s} onClick={() => setWeekFilter(s)}
                                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s', border: '1px solid', borderColor: weekFilter === s ? '#0b0b0b' : '#e4e4e7', background: weekFilter === s ? '#0b0b0b' : '#ffffff', color: weekFilter === s ? '#fff' : '#6a6a6a' }}>
                                {s === 'all' ? 'Latest' : s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-3.5">
                Performance Overview · {cur.sprint} ({cur.weekStart} → {cur.weekEnd})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Completion Rate', val: `${m.completion}%`, sub: `${cur.completed}/${cur.committed} SP`, c: metricColor(m.completion), badge: trendIcon(m.completion) + ' ' + (m.completion >= 85 ? 'On Target' : m.completion >= 65 ? 'Moderate' : 'Below') },
                    { label: 'Utilisation', val: `${m.utilisation}%`, sub: `${cur.days}/5 days logged`, c: metricColor(m.utilisation), badge: trendIcon(m.utilisation) + ' Capacity' },
                    { label: 'Quality Score', val: `${m.qualityScore}`, sub: `${cur.bugs} bug${cur.bugs !== 1 ? 's' : ''} introduced`, c: metricColor(m.qualityScore), badge: trendIcon(m.qualityScore) + ' ' + (m.qualityScore >= 85 ? 'Clean' : 'Review needed') },
                    { label: 'Efficiency Score', val: `${m.efficiency}`, sub: 'Composite /100', c: metricColor(m.efficiency), badge: trendIcon(m.efficiency) + ' Efficiency' },
                    { label: 'Goals Met', val: `${goalsMet}/${cur.goals.length}`, sub: `${tasksDone}/${tasksTotal} tasks done`, c: metricColor(goalsMet / Math.max(cur.goals.length, 1) * 100), badge: goalsMet === cur.goals.length && cur.goals.length > 0 ? 'All met' : goalsMet > 0 ? 'Partial' : 'Missed', badgeColor: 'rgba(22,163,74,.1)', badgeTextColor: '#059669' },
                ].map((k, i) => (
                    <div key={i} className="wp-kpi relative overflow-hidden rounded-xl p-5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10"
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', '--kpi-color': k.c }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 8 }}>{k.label}</div>
                        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: k.c, marginBottom: 4 }}>{k.val}</div>
                        <div style={{ fontSize: 11, color: '#8a8a8a', fontFamily: 'monospace' }}>{k.sub}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, marginTop: 8, background: k.badgeColor || `${k.c}22`, color: k.badgeTextColor || k.c }}>{k.badge}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Sprint Velocity Trend <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{devEntries.length} weeks</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
                        {devEntries.map(e => {
                            const cH = Math.round((e.committed / maxSP) * 100);
                            const dH = Math.round((e.completed / maxSP) * 100);
                            const pct = e.committed > 0 ? Math.round((e.completed / e.committed) * 100) : 0;
                            return (
                                <div key={e.sprint} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="flex-1 flex items-end gap-[3px] w-full">
                                        <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-white/10" style={{ height: `${cH}%` }} data-tip={`Committed: ${e.committed}SP`} />
                                        <div className="wp-bar flex-1 rounded-t min-h-[3px] cursor-pointer relative" style={{ height: `${dH}%`, background: 'linear-gradient(180deg,#ff6a1f,#e85511)' }} data-tip={`Done: ${e.completed}SP (${pct}%)`} />
                                    </div>
                                    <div style={{ fontSize: 10, color: '#8a8a8a', fontFamily: 'monospace' }}>{e.sprint}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'inline-block' }} /> Committed</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8a8a8a' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#ff6a1f', display: 'inline-block' }} /> Completed</div>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Goal Achievement <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 10, color: '#8a8a8a', fontWeight: 500 }}>{goalsMet}/{cur.goals.length} met</span>
                    </div>
                    {cur.goals.length ? cur.goals.map((g, i) => {
                        const pct = Math.min(100, Math.round((g.achieved / g.target) * 100));
                        const c = g.achieved >= g.target ? '#059669' : g.achieved >= g.target * .7 ? '#d97706' : '#ff4b2b';
                        return (
                            <div key={i} style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: c }}>{g.achieved}%</div>
                                </div>
                                <div style={{ height: 7, background: '#f4f4f5', borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, background: c, height: '100%', borderRadius: 20 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#8a8a8a' }}>Target: {g.target}%</div>
                                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: c }}>{g.achieved >= g.target ? '✓ Achieved' : '✗ Not met'}</div>
                                </div>
                            </div>
                        );
                    }) : <div style={{ color: '#8a8a8a', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No goals set for this week</div>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Tasks This Week</div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a8a' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Jira ID</th>
                                <th style={{ padding: '4px 8px' }}>Task</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>SP</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Product</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Module</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Type</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cur.tasks.length ? cur.tasks.map((t, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #f0ede8' }}>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        {t.jiraId ? <a href={`https://tapminds.atlassian.net/browse/${t.jiraId}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#ff6a1f', textDecoration: 'none', background: 'rgba(37,99,235,.08)', padding: '2px 8px', borderRadius: 5 }}>{t.jiraId} ↗</a> : <span style={{ color: '#8a8a8a', fontSize: 11 }}>—</span>}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 500, fontSize: 13 }}>{t.name}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff6a1f' }}>{t.sp}</span></td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontSize: 11, color: '#6a6a6a' }}>{t.product || '—'}</span></td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontSize: 11, color: '#ff6a1f', background: 'rgba(124,58,237,.07)', padding: '2px 8px', borderRadius: 5 }}>{t.module || '—'}</span></td>
                                    <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: '#8a8a8a' }}>{t.type}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...tagStyle[t.status] }}>{statusTag[t.status]?.lbl}</span></td>
                                </tr>
                            )) : <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8a8a8a', padding: 20 }}>No tasks logged</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Performance Radar</div>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                        <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: buildRadar(radarVals, radarLabels, radarColors) }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                        {radarLabels.map((l, i) => (
                            <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8a8a8a' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: radarColors[i], display: 'inline-block' }} />{l}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: radarColors[i], fontWeight: 600 }}>{radarVals[i]}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <svg width="88" height="88" viewBox="0 0 88 88">
                            <circle cx="44" cy="44" r="36" fill="none" stroke="#f4f4f5" strokeWidth="8" />
                            <circle cx="44" cy="44" r="36" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" transform="rotate(-90 44 44)" style={{ transition: '.6s' }} />
                            <text x="44" y="50" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="18" fontWeight="900" fill={scoreColor}>{score}</text>
                        </svg>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: scoreColor }}>{scoreLabel}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Developer Reflection</div>
                    {cur.achievements && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#059669', marginBottom: 6 }}>✓ Achievements</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.achievements}</div></div>}
                    {cur.challenges && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff4b2b', marginBottom: 6 }}>⚠ Blockers</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.challenges}</div></div>}
                    {cur.nextFocus && <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ff6a1f', marginBottom: 6 }}>→ Next Week Focus</div><div style={{ fontSize: 13, lineHeight: 1.6, color: '#6a6a6a' }}>{cur.nextFocus}</div></div>}
                    {!cur.achievements && !cur.challenges && !cur.nextFocus && <div style={{ textAlign: 'center', color: '#8a8a8a', padding: 20, fontSize: 13 }}>No reflection notes added</div>}
                </div>
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Manager Review Note</div>
                    <textarea value={managerNote} onChange={e => setManagerNote(e.target.value)} placeholder="Add manager feedback, coaching notes, or observations for this sprint…" className="wp-textarea" style={{ minHeight: 64 }} />
                    <button onClick={() => showToastGlobal('📝 Manager note saved!')} className="mt-2 px-4 py-2 bg-ink-900 text-white text-xs font-bold rounded-[7px] cursor-pointer border-none">Save Note</button>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e4e4e7' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { label: 'Reviews Done', val: cur.reviews, color: '#ff6a1f' },
                                { label: 'Carry-over SP', val: cur.carryover, color: '#d97706' },
                                { label: 'Blockers', val: cur.blockers, color: '#ff4b2b' },
                                { label: 'Self Rating', val: `${cur.selfRating}/10`, color: '#ff6a1f' },
                            ].map(x => (
                                <div key={x.label} style={{ borderRadius: 8, padding: 12 }} className="shadow-md">
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 4 }}>{x.label}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: x.color }}>{x.val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── HISTORY TAB ───────────────────────────────────────────────────────────────
function HistoryTab({ entries, onDelete, onEdit, onSwitchForm }) {
    const [newData, setNewData] = useState([]);
    const [loading, setLoading] = useState(true);
    const userStr = localStorage.getItem('authUserLD');
    const user = userStr ? JSON.parse(userStr) : null;
    const authUserLD = localStorage.getItem("authUserLD");
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [weekRange, setWeekRange] = useState(() => {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
        const end = new Date(start); end.setDate(start.getDate() + 4);
        return { start, end };
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = { filter: "", searchText: "", departmentID: 24 };
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    body,
                    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}` } }
                );
                const usersData = res.data.response.users || [];
                const formatted = usersData.map(u => ({ userID: u.userID, userName: u.userName }));
                setUsers(formatted);
                if (formatted.length > 0) setSelectedUser(formatted[0]);
            } catch (err) { console.error("Error fetching users:", err); }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const fetchEntries = async () => {
            try {
                setLoading(true);
                const result = await axios.get(
                    `t2.0/authentificationUtilization/getSprintEntry?userId=${selectedUser?.userID}&from=${weekRange.start.toISOString().slice(0, 10)}&to=${weekRange.end.toISOString().slice(0, 10)}`
                );
                const mapped = result.data.data.content.map(mapApiItem);
                setNewData(mapped);
            } catch (e) { console.error('Error fetching entries:', e); }
            finally { setLoading(false); }
        };
        fetchEntries();
    }, [weekRange, selectedUser]);

    const FilterBar = () => (
        <div className="flex gap-3 mb-4">
            <DateRangePicker variant="bordered" size="md"
                value={{ start: parseDate(weekRange.start.toISOString().slice(0, 10)), end: parseDate(weekRange.end.toISOString().slice(0, 10)) }}
                onChange={(range) => setWeekRange({ start: new Date(range.start.toString()), end: new Date(range.end.toString()) })}
            />
            <Select selectedKeys={[selectedUser?.userID?.toString()]}
                onSelectionChange={(keys) => { const id = Number(Array.from(keys)[0]); setSelectedUser(users.find(u => u.userID === id)); }}>
                {users.map(u => <SelectItem key={u.userID}>{u.userName}</SelectItem>)}
            </Select>
        </div>
    );

    if (loading) return <div style={{ margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: 14 }}>Loading history...</div>;
    if (!newData.length) return (
        <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
            <FilterBar />
            <EmptyState title="No entries yet" sub="Submit sprint entries to see your history here" btnLabel="Log First Sprint →" onBtn={onSwitchForm} />
        </div>
    );

    const sorted = [...newData].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const color = v => v >= 85 ? '#059669' : v >= 65 ? '#d97706' : '#ff4b2b';

    return (
        <div style={{ margin: '0 auto', padding: '36px 40px 60px' }}>
            <FilterBar />
            <div className="wp-section-title flex items-center gap-2.5 text-[11px] font-bold tracking-[2px] uppercase text-ink-400 mb-4">
                All Sprint Entries <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, marginLeft: 6, color: '#8a8a8a' }}>{newData.length} total</span>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                        <col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 110 }} /><col style={{ width: 180 }} />
                        <col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} />
                        <col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 120 }} />
                    </colgroup>
                    <thead>
                        <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a8a', textAlign: 'left' }}>
                            <th style={{ paddingBottom: 8 }}>Developer</th><th style={{ paddingBottom: 8 }}>Sprint</th><th style={{ paddingBottom: 8 }}>Week</th>
                            <th style={{ paddingBottom: 8 }}>Jira IDs</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>SP</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Completion</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>Utilisation</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Efficiency</th><th style={{ paddingBottom: 8, textAlign: 'center' }}>Bugs</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Goals</th>
                            {user?.userID != 1 && <th style={{ paddingBottom: 8, textAlign: 'center' }}>Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(e => {
                            const goalsMet = e.goals.filter(g => g.achieved >= g.target).length;
                            return (
                                <tr key={e.id} style={{ borderTop: '1px solid #eee', transition: 'background .15s' }}>
                                    <td style={{ padding: '8px 4px' }}><div style={{ fontWeight: 600 }}>{e.name}</div></td>
                                    <td style={{ padding: '8px 4px' }}><span style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#f5f5f5' }}>{e.sprint}</span></td>
                                    <td style={{ padding: '8px 4px', fontSize: 12, color: '#8a8a8a', fontFamily: 'monospace' }}>{e.weekStart || ''}</td>
                                    <td style={{ padding: '8px 4px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 160 }}>
                                            {e.tasks.filter(t => t.jiraId).length
                                                ? e.tasks.filter(t => t.jiraId).map((t, i) => <span key={i} style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#ff6a1f', background: 'rgba(37,99,235,.07)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{t.jiraId}</span>)
                                                : <span style={{ color: '#8a8a8a', fontSize: 12 }}>—</span>}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#ff6a1f' }}>{e.completed}/{e.committed}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.completion) }}>{e.metrics.completion}%</span></td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.utilisation) }}>{e.metrics.utilisation}%</span></td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: color(e.metrics.efficiency) }}>{e.metrics.efficiency}/100</span></td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: e.bugs <= 1 ? '#059669' : e.bugs <= 3 ? '#d97706' : '#ff4b2b' }}>{e.bugs}</span></td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{goalsMet}/{e.goals.length}</td>
                                    {user?.userID != 1 && (
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button onClick={() => onEdit(e)} style={{ border: '1px solid #e4e4e7', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent' }}>Edit</button>
                                            <button onClick={() => onDelete(e.id)} style={{ marginLeft: 4, border: '1px solid #fecaca', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fef2f2', color: '#ff4b2b' }}>Del</button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── TOAST ─────────────────────────────────────────────────────────────────────
let _toastFn = null;
function showToastGlobal(msg, bg) { _toastFn && _toastFn(msg, bg); }
function Toast() {
    const [state, setState] = useState({ msg: '', bg: '', show: false });
    useEffect(() => {
        _toastFn = (msg, bg) => {
            setState({ msg, bg: bg || '', show: true });
            setTimeout(() => setState(s => ({ ...s, show: false })), 2800);
        };
    }, []);
    return (
        <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-white z-[9999] transition-all duration-300 ${state.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}`}
            style={{ background: state.bg || '#0b0b0b', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
            <span className="text-lg">{state.msg.slice(0, 2)}</span>
            <span>{state.msg.slice(2)}</span>
        </div>
    );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function WeeklyPulse() {
    const userStr = localStorage.getItem('authUserLD');
    const user = userStr ? JSON.parse(userStr) : null;
    const [tab, setTab] = useState(user?.userID == 1 || user?.userRole == 1 ? 'history' : 'form');
    const [entries, setEntries] = useState([]);
    const [editEntry, setEditEntry] = useState(null);

    function transformEntry(item) {
        return {
            userId: user?.userID,
            sprintLabel: item.sprint,
            weekStart: item.weekStart,
            weekEnd: item.weekEnd,
            daysPresent: item.days,
            spCommitted: item.committed,
            spCompleted: item.completed,
            bugsIntroduced: item.bugs,
            prReviews: item.reviews,
            spCarryover: item.carryover,
            blockers: item.blockers,
            selfRating: item.selfRating,
            achievements: item.achievements || '',
            challenges: item.challenges || '',
            nextFocus: item.nextFocus || '',
            tasks: item.tasks.map((t, i) => ({
                jiraId: t.jiraId,
                taskName: t.name,
                storyPoints: t.sp,
                product: t.product?.toUpperCase().replace(/ /g, '_'),
                module: (t.module || '').toUpperCase().replace(/[ /]+/g, '_'),
                taskType: t.type?.toUpperCase().replace(/ /g, '_'),
                status: t.status?.toUpperCase(),
                sortOrder: i + 1,
            })),
            goals: item.goals.map((g, i) => ({
                goalName: g.name,
                targetPct: g.target,
                achievedPct: g.achieved,
                sortOrder: i + 1,
            })),
        };
    }

    async function createEntry(entry) {
        const payload = transformEntry(entry);
        await axios.post('t2.0/authentificationUtilization/createSprintEntry', payload, {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async function updateEntry(entry) {
        const payload = transformEntry(entry);
        await axios.put(`t2.0/authentificationUtilization/${entry.id}`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async function handleSubmit(entry) {
        const isEdit = !!editEntry;
        try {
            if (isEdit) {
                await updateEntry(entry);
                showToastGlobal('✅ Sprint entry updated!');
            } else {
                await createEntry(entry);
                showToastGlobal('✅ Sprint entry saved successfully!');
            }
            setEntries(prev => {
                const idx = prev.findIndex(e => e.id === entry.id);
                return idx >= 0 ? prev.map((e, i) => i === idx ? entry : e) : [...prev, entry];
            });
            setEditEntry(null);
            setTimeout(() => setTab('dashboard'), 900);
        } catch (err) {
            console.error('Save error:', err);
            showToastGlobal('❌ Failed to save entry', '#ff4b2b');
        }
    }

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/t2.0/authentificationUtilization/${id}`);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    function handleEdit(entry) {
        setEditEntry(entry);
        setTab('form');
    }

    return (
        <div className="relative min-h-screen isolate text-ink-900 dark:text-white">
            <style>{GLOBAL_STYLE}</style>
            <header className="px-10 flex items-center justify-between h-16">
                <Tabs
                    className="wp-tabs"
                    selectedKey={tab}
                    onSelectionChange={key => setTab(String(key))}
                    variant="light"
                    aria-label="WeeklyPulse navigation"
                    disableAnimation={false}
                >
                    <>
                        {user?.userID !== 1 && <Tab key="form" title="Log Sprint" />}
                        <Tab key="dashboard" title="Dashboard" />
                        <Tab key="history" title="History" />
                    </>
                </Tabs>
            </header>

            {tab === 'form' && (
                <FormTab
                    key={editEntry?.id ?? 'new'}
                    initialEntry={editEntry}
                    onSubmit={entry => { handleSubmit(entry); }}
                    onSwitchDashboard={() => { setEditEntry(null); setTab('dashboard'); }}
                />
            )}
            {tab === 'dashboard' && <DashboardTab entries={entries} onSwitchForm={() => setTab('form')} />}
            {tab === 'history' && <HistoryTab entries={entries} onDelete={handleDelete} onEdit={handleEdit} onSwitchForm={() => setTab('form')} />}

            <Toast />
        </div>
    );
}