import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { fetchBuildStatus, type ThemeBuildStatus } from "@/services/themeApi";
import {
  listThemeFiles, readThemeFile, writeThemeFile, deleteThemeFile,
  scaffoldTheme, publishThemeCode,
} from "@/services/themeCodeApi";
import {
  ChevronLeft, ChevronRight, File as FileIcon, FileJson, FileCode2, FileText,
  FolderOpen, Folder, Save, Rocket, Loader2, Plus, Trash2, Sparkles,
  CheckCircle2, AlertTriangle, Code2, RefreshCw, X, Hash,
} from "lucide-react";

/* Online Store → Edit code. A VS Code / Shopify-style theme code editor:
   a file tree on the left, editor tabs + breadcrumb on top, Monaco (the
   actual VS Code engine) in the center. Files live in the store's
   `store_theme_files` workspace and are seeded from the active theme's real
   source; "Publish" runs them through the same external-theme build pipeline
   as GitHub/dev BYOT themes. Outside DashboardLayout for the full viewport. */

const langFor = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": return "javascript";
    case "json": return "json";
    case "css": return "css";
    case "html": return "html";
    case "md": return "markdown";
    default: return "plaintext";
  }
};

// Color-coded file-type glyph, VS Code style.
function FileGlyph({ path, className = "h-3.5 w-3.5" }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "json") return <FileJson className={`${className} text-amber-500`} />;
  if (ext === "ts" || ext === "tsx") return <FileCode2 className={`${className} text-sky-500`} />;
  if (ext === "js" || ext === "jsx") return <FileCode2 className={`${className} text-yellow-500`} />;
  if (ext === "css") return <Hash className={`${className} text-blue-400`} />;
  if (ext === "html") return <FileCode2 className={`${className} text-orange-500`} />;
  if (ext === "md") return <FileText className={`${className} text-muted-foreground`} />;
  return <FileIcon className={`${className} text-muted-foreground`} />;
}

// ── File tree ────────────────────────────────────────────────────────────────
interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  for (const full of paths) {
    const parts = full.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part && c.isDir === !isLeaf);
      if (!child) {
        child = { name: part, path, isDir: !isLeaf, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function TreeRow({
  node, depth, activePath, dirtyPaths, onSelect, onDelete,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingInlineStart: `${depth * 12 + 8}px` };

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1 py-[3px] px-2 text-[13px] text-[#cccccc]/80 hover:bg-white/5 text-start"
          style={pad}
        >
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#dcb67a]" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-[#dcb67a]" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children.map((c) => (
          <TreeRow key={c.path} node={c} depth={depth + 1} activePath={activePath} dirtyPaths={dirtyPaths} onSelect={onSelect} onDelete={onDelete} />
        ))}
      </div>
    );
  }
  const isActive = activePath === node.path;
  const isDirty = dirtyPaths.has(node.path);
  return (
    <div
      className={`group/file flex items-center gap-1.5 py-[3px] px-2 text-[13px] cursor-pointer ${isActive ? "bg-[#37373d] text-white" : "text-[#cccccc]/90 hover:bg-white/5"}`}
      style={{ paddingInlineStart: `${depth * 12 + 8 + 16}px` }}
      onClick={() => onSelect(node.path)}
    >
      <FileGlyph path={node.name} />
      <span className="truncate flex-1">{node.name}</span>
      {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-white/80 shrink-0" title="Unsaved" />}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
        className="opacity-0 group-hover/file:opacity-100 text-[#cccccc]/60 hover:text-red-400 shrink-0"
        aria-label="Delete file"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

const ThemeCodeEditor = () => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [buildStatus, setBuildStatus] = useState<ThemeBuildStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSeedRef = useRef(false);

  const filesQuery = useQuery({
    queryKey: ["theme-code-files", storeId],
    queryFn: () => listThemeFiles(storeId!),
    enabled: !!storeId,
    retry: 1,
  });
  const files = filesQuery.data?.files ?? [];
  const hasWorkspace = filesQuery.data?.has_workspace ?? false;
  const tree = useMemo(() => buildTree(files.map((f) => f.path)), [files]);

  const openFile = useCallback(async (path: string) => {
    setActivePath(path);
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    if (contents[path] === undefined && storeId) {
      try {
        const f = await readThemeFile(storeId, path);
        setContents((c) => ({ ...c, [path]: f.content }));
      } catch (e) { showError(e); }
    }
  }, [contents, storeId]);

  const closeTab = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      if (activePath === path) {
        const idx = tabs.indexOf(path);
        setActivePath(next[idx] ?? next[idx - 1] ?? next[0] ?? null);
      }
      return next;
    });
  };

  const onChange = (value?: string) => {
    if (activePath == null) return;
    setContents((c) => ({ ...c, [activePath]: value ?? "" }));
    setDirty((d) => new Set(d).add(activePath));
  };

  const saveActive = useCallback(async () => {
    if (!storeId || activePath == null || !dirty.has(activePath)) return;
    setSaving(true);
    try {
      await writeThemeFile(storeId, activePath, contents[activePath] ?? "");
      setDirty((d) => { const n = new Set(d); n.delete(activePath); return n; });
      toast.success(isRTL ? "تم الحفظ" : "Saved");
    } catch (e) { showError(e); } finally { setSaving(false); }
  }, [storeId, activePath, dirty, contents, isRTL]);

  const handleScaffold = async () => {
    if (!storeId) return;
    setScaffolding(true);
    try {
      const res = await scaffoldTheme(storeId, { name: currentStore?.name || "My Theme" });
      toast.success(res.message);
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (!/already exists/i.test(msg)) showError(e);
    } finally {
      await filesQuery.refetch();
      setScaffolding(false);
    }
  };

  const handleNewFile = async () => {
    if (!storeId || !newFilePath.trim()) return;
    const path = newFilePath.trim();
    try {
      await writeThemeFile(storeId, path, "");
      setNewFilePath("");
      setNewFileOpen(false);
      await filesQuery.refetch();
      setContents((c) => ({ ...c, [path]: "" }));
      openFile(path);
    } catch (e) { showError(e); }
  };

  const handleDelete = async (path: string) => {
    if (!storeId) return;
    if (!window.confirm(isRTL ? `حذف ${path}؟` : `Delete ${path}?`)) return;
    try {
      await deleteThemeFile(storeId, path);
      setContents((c) => { const n = { ...c }; delete n[path]; return n; });
      setDirty((d) => { const n = new Set(d); n.delete(path); return n; });
      closeTab(path);
      await filesQuery.refetch();
    } catch (e) { showError(e); }
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handlePublish = async () => {
    if (!storeId) return;
    if (activePath && dirty.has(activePath)) await saveActive();
    try {
      const res = await publishThemeCode(storeId);
      setBuildStatus(res.status);
      toast.success(isRTL ? "بدأ النشر…" : "Build started…");
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetchBuildStatus(storeId, res.build_id);
          setBuildStatus(s.status);
          if (s.status === "complete") {
            stopPolling();
            toast.success(isRTL ? "تم النشر بنجاح 🎉" : "Published successfully 🎉");
          } else if (s.status === "failed") {
            stopPolling();
            toast.error((isRTL ? "فشل النشر: " : "Build failed: ") + (s.error ?? ""));
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e) { showError(e); }
  };

  // First-open auto-seed: a store that has never opened the editor gets a real,
  // buildable starter theme so the workspace is never an empty void (Shopify
  // seeds a theme too). Guarded so it runs at most once per mount.
  useEffect(() => {
    if (
      !autoSeedRef.current &&
      !filesQuery.isLoading &&
      !filesQuery.isError &&
      filesQuery.data &&
      !hasWorkspace &&
      !scaffolding
    ) {
      autoSeedRef.current = true;
      handleScaffold();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesQuery.isLoading, filesQuery.isError, filesQuery.data, hasWorkspace]);

  const dirtyCount = dirty.size;
  const building = buildStatus != null && buildStatus !== "complete" && buildStatus !== "failed";
  const crumbs = activePath ? activePath.split("/") : [];

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc]" onKeyDown={(e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveActive(); }
    }}>
      {/* Title bar */}
      <header className="h-11 shrink-0 flex items-center gap-3 px-3 bg-[#323233] border-b border-black/40">
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-[#cccccc] hover:bg-white/10 hover:text-white" onClick={() => navigate("/online-store")}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {isRTL ? "رجوع" : "Back"}
        </Button>
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Code2 className="h-4 w-4 text-sky-400" />
          <span>{isRTL ? "محرّر الكود" : "Edit code"}</span>
        </div>
        <span className="text-xs text-[#cccccc]/50 truncate hidden sm:inline">{currentStore?.name}</span>
        <div className="ms-auto flex items-center gap-2">
          {buildStatus && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              buildStatus === "complete" ? "bg-emerald-500/20 text-emerald-300"
              : buildStatus === "failed" ? "bg-red-500/20 text-red-300"
              : "bg-amber-500/20 text-amber-300"}`}>
              {building && <Loader2 className="h-3 w-3 animate-spin" />}
              {buildStatus === "complete" && <CheckCircle2 className="h-3 w-3" />}
              {buildStatus === "failed" && <AlertTriangle className="h-3 w-3" />}
              {buildStatus}
            </span>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-[#cccccc] hover:bg-white/10 hover:text-white" onClick={saveActive} disabled={saving || dirtyCount === 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isRTL ? "حفظ" : "Save"}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
          <Button size="sm" className="gap-1.5 h-8 bg-sky-600 hover:bg-sky-500 text-white border-0" onClick={handlePublish} disabled={building || !hasWorkspace}>
            {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            {isRTL ? "نشر" : "Publish"}
          </Button>
        </div>
      </header>

      {/* Model banner — explains the edit-your-theme / Publish-to-go-live loop */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-sky-500/10 border-b border-sky-500/20 text-[12px] text-sky-300">
        <Code2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          {isRTL
            ? "أنت تعدّل نسخة ثيم متجرك. التعديلات تُحفظ كمسودة — اضغط نشر لبنائها وتفعيلها على المتجر المباشر."
            : "You're editing your store's theme. Edits save as a draft — click Publish to build & make them live."}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        {/* Activity-bar + Explorer */}
        <aside className="w-64 shrink-0 bg-[#252526] flex flex-col border-e border-black/40">
          <div className="h-9 shrink-0 flex items-center justify-between px-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#cccccc]/60">
              {isRTL ? "المستكشف" : "Explorer"}
            </span>
            {hasWorkspace && (
              <button type="button" onClick={() => setNewFileOpen((o) => !o)} className="text-[#cccccc]/60 hover:text-white" aria-label="New file">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {newFileOpen && (
            <div className="px-2 pb-2 flex gap-1.5">
              <input
                autoFocus
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleNewFile(); if (e.key === "Escape") setNewFileOpen(false); }}
                placeholder="src/sections/New.tsx"
                className="flex-1 min-w-0 h-7 px-2 text-xs rounded bg-[#3c3c3c] border border-black/40 text-white font-mono outline-none focus:border-sky-500"
                dir="ltr"
              />
              <Button size="sm" className="h-7 px-2 bg-sky-600 hover:bg-sky-500 text-white border-0" onClick={handleNewFile}>{isRTL ? "أضف" : "Add"}</Button>
            </div>
          )}
          <div className="flex-1 overflow-auto py-1">
            {filesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#cccccc]/50" /></div>
            ) : filesQuery.isError ? (
              <div className="text-center px-3 py-8 space-y-3">
                <AlertTriangle className="h-7 w-7 mx-auto text-amber-400/80" />
                <p className="text-xs text-[#cccccc]/70">
                  {isRTL ? "تعذّر تحميل الملفات." : "Couldn't load files."}
                </p>
                <p className="text-[11px] text-[#cccccc]/50 break-words font-mono" dir="ltr">
                  {(filesQuery.error as Error)?.message?.slice(0, 160)}
                </p>
                <Button size="sm" variant="outline" className="gap-1.5 w-full bg-transparent border-white/20 text-[#cccccc] hover:bg-white/10" onClick={() => filesQuery.refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isRTL ? "إعادة المحاولة" : "Retry"}
                </Button>
              </div>
            ) : !hasWorkspace ? (
              <div className="text-center px-3 py-8 space-y-3">
                <Sparkles className="h-7 w-7 mx-auto text-[#cccccc]/40" />
                <p className="text-xs text-[#cccccc]/70">
                  {isRTL ? "لا توجد ملفات بعد." : "No files yet."}
                </p>
                <Button size="sm" className="gap-1.5 w-full bg-sky-600 hover:bg-sky-500 text-white border-0" onClick={handleScaffold} disabled={scaffolding}>
                  {scaffolding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isRTL ? "أنشئ ثيم مبدئي" : "Scaffold starter theme"}
                </Button>
              </div>
            ) : (
              tree.children.map((c) => (
                <TreeRow key={c.path} node={c} depth={0} activePath={activePath} dirtyPaths={dirty} onSelect={openFile} onDelete={handleDelete} />
              ))
            )}
          </div>
        </aside>

        {/* Editor area */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e]">
          {openTabs.length > 0 ? (
            <>
              {/* Tabs */}
              <div className="h-9 shrink-0 flex items-stretch bg-[#252526] overflow-x-auto border-b border-black/40">
                {openTabs.map((path) => {
                  const name = path.split("/").pop()!;
                  const isActive = activePath === path;
                  return (
                    <div
                      key={path}
                      onClick={() => setActivePath(path)}
                      className={`group/tab flex items-center gap-2 px-3 cursor-pointer border-e border-black/40 text-[13px] whitespace-nowrap ${isActive ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#cccccc]/70 hover:bg-[#2a2a2a]"}`}
                    >
                      <FileGlyph path={name} className="h-3.5 w-3.5" />
                      <span>{name}</span>
                      {dirty.has(path) && <span className="h-1.5 w-1.5 rounded-full bg-white/80" />}
                      <button
                        type="button"
                        onClick={(e) => closeTab(path, e)}
                        className="opacity-0 group-hover/tab:opacity-100 hover:bg-white/15 rounded p-0.5"
                        aria-label="Close tab"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Breadcrumb */}
              <div className="h-7 shrink-0 flex items-center gap-1 px-3 text-[12px] text-[#cccccc]/60 bg-[#1e1e1e] border-b border-black/30" dir="ltr">
                {crumbs.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                    {i === crumbs.length - 1 && <FileGlyph path={seg} className="h-3.5 w-3.5" />}
                    <span className={i === crumbs.length - 1 ? "text-[#cccccc]" : ""}>{seg}</span>
                  </span>
                ))}
              </div>
              {/* Monaco */}
              <div className="flex-1 min-h-0">
                {activePath && (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activePath}
                    language={langFor(activePath)}
                    value={contents[activePath] ?? ""}
                    onChange={onChange}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 13,
                      tabSize: 2,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: "on",
                      renderWhitespace: "selection",
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#666] gap-2">
              <Code2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">{isRTL ? "اختر ملفًا للتعديل" : "Select a file to edit"}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ThemeCodeEditor;
