"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createLesson,
  deleteLesson,
  filesFromList,
  getAllLessons,
  type LessonRecord,
  type StoredFile,
  updateLesson,
} from "@/lib/lessons-db";

type SortMode = "newest" | "oldest" | "week-asc" | "week-desc";
type FilterField = "all" | "week" | "date" | "title" | "description";

const LOGIN_USERNAME = "admin";
const LOGIN_PASSWORD = "123456789";

const acceptedFileTypes = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".txt",
  ".zip",
  ".rar",
  ".7z",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".csv",
  ".md",
  ".json",
].join(",");

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatDateGerman(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function fileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "DATEI";
}

function fileIcon(fileType: string, fileName: string) {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType === "application/pdf") return "📄";
  if (fileType.includes("zip") || /\.(zip|rar|7z)$/i.test(fileName)) return "🗜️";
  if (fileType.includes("presentation") || /\.(ppt|pptx)$/i.test(fileName)) return "📊";
  if (fileType.includes("word") || /\.(doc|docx)$/i.test(fileName)) return "📝";
  if (fileType.startsWith("text/")) return "📃";
  return "📁";
}

function canPreview(file: StoredFile) {
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type.startsWith("text/") ||
    file.name.toLowerCase().endsWith(".md")
  );
}

function LessonModal({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    week: number;
    date: string;
    title: string;
    description: string;
    files: StoredFile[];
    id?: string;
    createdAt?: string;
  }) => Promise<void>;
  initial: LessonRecord | null;
}) {
  const [week, setWeek] = useState<string>(initial?.week.toString() ?? "");
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [existingFiles, setExistingFiles] = useState<StoredFile[]>(initial?.files ?? []);
  const [newFiles, setNewFiles] = useState<StoredFile[]>([]);
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWeek(initial?.week.toString() ?? "");
    setDate(initial?.date ?? "");
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setExistingFiles(initial?.files ?? []);
    setNewFiles([]);
    setError("");
    setSaving(false);
  }, [open, initial]);

  if (!open) return null;

  const mergedFiles = [...existingFiles, ...newFiles];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weekNumber = Number(week);

    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      setError("Bitte eine gültige Woche eingeben.");
      return;
    }
    if (!date) {
      setError("Bitte ein Datum auswählen.");
      return;
    }
    if (!title.trim()) {
      setError("Bitte ein Thema eingeben.");
      return;
    }
    if (!description.trim()) {
      setError("Bitte eine Beschreibung eingeben.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        week: weekNumber,
        date,
        title: title.trim(),
        description: description.trim(),
        files: mergedFiles,
        id: initial?.id,
        createdAt: initial?.createdAt,
      });
      onClose();
    } catch {
      setError("Die Lektion konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function onFilesSelected(fileList: FileList | null) {
    const converted = await filesFromList(fileList);
    setNewFiles((prev) => [...prev, ...converted]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Lektion bearbeiten" : "Lektion hinzufügen"}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0d0d10]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Lernarchiv</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
              {initial ? "Lektion bearbeiten" : "Neue Lektion"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-[#b9a066] hover:text-white"
            type="button"
          >
            Abbrechen
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Datum</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121217] px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Woche</span>
              <input
                type="number"
                min={1}
                placeholder="z. B. 38"
                value={week}
                onChange={(event) => setWeek(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121217] px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Lesson / Thema</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="PHP – Funktionen und Parameter"
              className="w-full rounded-xl border border-white/10 bg-[#121217] px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Beschreibung</span>
            <textarea
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Was wurde gelernt? Welche Kernpunkte sind wichtig?"
              className="w-full rounded-xl border border-white/10 bg-[#121217] px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Datei hochladen</span>
            <input
              type="file"
              multiple
              accept={acceptedFileTypes}
              onChange={(event) => {
                void onFilesSelected(event.target.files);
                event.target.value = "";
              }}
              className="w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-[#121217] px-4 py-3 text-sm text-zinc-300 outline-none transition hover:border-[#b9a066]"
            />
          </label>

          {mergedFiles.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Dateien ({mergedFiles.length})</p>
              <div className="mt-3 grid gap-2">
                {mergedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span aria-hidden>{fileIcon(file.type, file.name)}</span>
                      <p className="text-sm text-zinc-200">{file.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">{fileExtension(file.name)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setExistingFiles((prev) => prev.filter((entry) => entry.id !== file.id));
                          setNewFiles((prev) => prev.filter((entry) => entry.id !== file.id));
                        }}
                        className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-300 transition hover:border-red-400/60 hover:text-red-300"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/20 px-5 py-3 text-sm text-zinc-200 transition hover:border-white/35"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#b9a066] px-5 py-3 text-sm font-medium text-black transition hover:bg-[#c9af72] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Speichern …" : "Lektion speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LessonDetails({
  lesson,
  onClose,
}: {
  lesson: LessonRecord;
  onClose: () => void;
}) {
  function openPreview(file: StoredFile) {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (file.data) {
      const url = URL.createObjectURL(file.data);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  function downloadFile(file: StoredFile) {
    if (file.url) {
      const anchor = document.createElement("a");
      anchor.href = file.url;
      anchor.download = file.name;
      anchor.target = "_blank";
      anchor.click();
      return;
    }
    if (file.data) {
      const url = URL.createObjectURL(file.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 8_000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0f1014]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Woche {lesson.week}</p>
            <h3 className="mt-2 text-2xl font-semibold text-zinc-100">{lesson.title}</h3>
            <p className="mt-2 text-sm text-zinc-300">{formatDateGerman(lesson.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-[#b9a066]"
          >
            Schließen
          </button>
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Beschreibung</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{lesson.description}</p>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Dateien</p>
          {lesson.files.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">Keine Dateien gespeichert.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {lesson.files.map((file) => (
                <article key={file.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg" aria-hidden>
                        {fileIcon(file.type, file.name)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{file.name}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {fileExtension(file.name)} · {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {canPreview(file) ? (
                      <button
                        onClick={() => openPreview(file)}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:border-[#b9a066]"
                        type="button"
                      >
                        Vorschau
                      </button>
                    ) : null}
                    <button
                      onClick={() => downloadFile(file)}
                      className="rounded-lg bg-[#b9a066] px-3 py-2 text-xs font-medium text-black transition hover:bg-[#c9af72]"
                      type="button"
                    >
                      Herunterladen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) setDeleting(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111217]/95 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
        <h4 className="text-lg font-semibold text-zinc-100">Lektion löschen?</h4>
        <p className="mt-2 text-sm text-zinc-300">
          Diese Lektion und ihre gespeicherten Informationen werden entfernt.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/35"
            disabled={deleting}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Löschen …" : "Löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LearningArchiveApp() {
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filterField, setFilterField] = useState<FilterField>("all");

  const [showModal, setShowModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonRecord | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LessonRecord | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const dashboardRef = useRef<HTMLElement | null>(null);
  const videoClockRef = useRef(0);
  const playbackDirectionRef = useRef<1 | -1>(1);
  const lastFrameAtRef = useRef<number | null>(null);
  const lastScrollAtRef = useRef(Date.now());

  const [storageMode, setStorageMode] = useState<"cloud" | "local">("local");

  useEffect(() => {
    let mounted = true;
    async function loadLessons() {
      try {
        const res = await fetch("/api/lessons");
        const json = await res.json();
        if (json.ok && json.mode === "cloud") {
          if (!mounted) return;
          setLessons(json.lessons);
          setStorageMode("cloud");
          setIsLoading(false);
          return;
        }
      } catch {
        // API offline or fallback to local
      }

      const data = await getAllLessons();
      if (!mounted) return;
      setLessons(data);
      setStorageMode("local");
      setIsLoading(false);
    }
    void loadLessons();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onScroll() {
      const hero = heroRef.current;
      if (!hero) return;

      const rect = hero.getBoundingClientRect();
      const total = Math.max(1, hero.offsetHeight - window.innerHeight);
      const scrolled = clamp(-rect.top / total, 0, 1);
      setScrollProgress(scrolled);
      lastScrollAtRef.current = Date.now();
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    function animate() {
      const video = videoRef.current;
      if (!video) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const lastFrame = lastFrameAtRef.current ?? now;
      const deltaSeconds = Math.max(0.001, Math.min(0.08, (now - lastFrame) / 1000));
      lastFrameAtRef.current = now;

      const isUserScrolling = Date.now() - lastScrollAtRef.current < 150;

      if (isUserScrolling) {
        if (!video.paused) {
          video.pause();
        }
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const maxTime = Math.max(0.05, video.duration - 0.05);
          const targetTime = clamp(scrollProgress, 0, 1) * maxTime;
          const current = videoClockRef.current;
          const nextClock = current + (targetTime - current) * 0.2;
          videoClockRef.current = nextClock;
          playbackDirectionRef.current = targetTime >= current ? 1 : -1;

          if (!video.seeking && Math.abs(video.currentTime - nextClock) > 0.01) {
            video.currentTime = clamp(nextClock, 0, maxTime);
          }
        }
      } else {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const duration = video.duration;
          const minTime = 0.05;
          const maxTime = Math.max(minTime, duration - 0.08);

          if (playbackDirectionRef.current === 1) {
            if (video.paused) {
              video.play().catch(() => {});
            }
            videoClockRef.current = video.currentTime;

            if (video.currentTime >= maxTime) {
              video.pause();
              video.currentTime = maxTime;
              videoClockRef.current = maxTime;
              playbackDirectionRef.current = -1;
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
            const playbackSpeed = 1.0;
            let nextClock = videoClockRef.current - deltaSeconds * playbackSpeed;

            if (nextClock <= minTime) {
              nextClock = minTime;
              playbackDirectionRef.current = 1;
              video.currentTime = minTime;
              videoClockRef.current = minTime;
              video.play().catch(() => {});
            } else {
              videoClockRef.current = nextClock;
              if (!video.seeking && Math.abs(video.currentTime - nextClock) > 0.008) {
                video.currentTime = nextClock;
              }
            }
          }
        }
      }

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [scrollProgress]);

  const stats = useMemo(() => {
    const uniqueWeeks = new Set(lessons.map((lesson) => lesson.week));
    const fileCount = lessons.reduce((sum, lesson) => sum + lesson.files.length, 0);
    return {
      weeks: uniqueWeeks.size,
      lessons: lessons.length,
      files: fileCount,
    };
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase();

    const searched = lessons.filter((lesson) => {
      if (!q) return true;

      const inWeek = `woche ${lesson.week}`.toLowerCase().includes(q) || String(lesson.week).includes(q);
      const inDate = formatDateGerman(lesson.date).toLowerCase().includes(q) || lesson.date.includes(q);
      const inTitle = lesson.title.toLowerCase().includes(q);
      const inDescription = lesson.description.toLowerCase().includes(q);

      if (filterField === "week") return inWeek;
      if (filterField === "date") return inDate;
      if (filterField === "title") return inTitle;
      if (filterField === "description") return inDescription;
      return inWeek || inDate || inTitle || inDescription;
    });

    const sorted = [...searched];

    sorted.sort((a, b) => {
      if (sortMode === "newest") return b.date.localeCompare(a.date);
      if (sortMode === "oldest") return a.date.localeCompare(b.date);
      if (sortMode === "week-asc") return a.week - b.week || a.date.localeCompare(b.date);
      if (sortMode === "week-desc") return b.week - a.week || b.date.localeCompare(a.date);
      return 0;
    });

    return sorted;
  }, [lessons, query, filterField, sortMode]);

  async function saveLesson(payload: {
    week: number;
    date: string;
    title: string;
    description: string;
    files: StoredFile[];
    id?: string;
    createdAt?: string;
  }) {
    if (storageMode === "cloud") {
      const formData = new FormData();
      if (payload.id) formData.append("id", payload.id);
      formData.append("week", String(payload.week));
      formData.append("date", payload.date);
      formData.append("title", payload.title);
      formData.append("description", payload.description);
      if (payload.createdAt) formData.append("createdAt", payload.createdAt);

      const existingFiles = payload.files.filter((f) => !f.fileInstance);
      const newFiles = payload.files.filter((f) => f.fileInstance || f.data instanceof File);

      formData.append("existingFiles", JSON.stringify(existingFiles));

      for (const file of newFiles) {
        const instance = file.fileInstance || (file.data instanceof File ? file.data : null);
        if (instance) {
          formData.append("newFiles", instance, file.name);
        }
      }

      const res = await fetch("/api/lessons", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "Speichern fehlgeschlagen");
      }

      const savedLesson: LessonRecord = json.lesson;
      setLessons((prev) => {
        const exists = prev.some((l) => l.id === savedLesson.id);
        if (exists) {
          return prev.map((l) => (l.id === savedLesson.id ? savedLesson : l));
        }
        return [savedLesson, ...prev];
      });
      return;
    }

    if (payload.id && payload.createdAt) {
      const updated = await updateLesson(
        payload.id,
        {
          week: payload.week,
          date: payload.date,
          title: payload.title,
          description: payload.description,
          files: payload.files,
        },
        payload.createdAt,
      );
      setLessons((prev) => prev.map((lesson) => (lesson.id === updated.id ? updated : lesson)));
      return;
    }

    const created = await createLesson({
      week: payload.week,
      date: payload.date,
      title: payload.title,
      description: payload.description,
      files: payload.files,
    });
    setLessons((prev) => [created, ...prev]);
  }

  async function removeLesson(id: string) {
    if (storageMode === "cloud") {
      const res = await fetch(`/api/lessons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "Löschen fehlgeschlagen");
      }
    } else {
      await deleteLesson(id);
    }
    setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
    setDeleteTarget(null);
    if (selectedLesson?.id === id) {
      setSelectedLesson(null);
    }
  }

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim() === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
      setLoginError("");
      setIsAuthenticated(true);
      setTimeout(() => {
        dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
      return;
    }
    setLoginError("Benutzername oder Passwort ist falsch.");
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setLoginError("");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  const loginReveal = clamp((scrollProgress - 0.14) / 0.28, 0, 1);
  const heroTranslate = Math.round(scrollProgress * -80);
  const heroScale = 1 + scrollProgress * 0.06;

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#060607] text-zinc-100">
      <section ref={heroRef} className="relative h-[225vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <video
            ref={videoRef}
            src="/videos/hero.mp4"
            muted
            playsInline
            autoPlay
            preload="auto"
            onError={(e) => {
              // Fallback to Google Drive URL if local file is missing
              const video = e.currentTarget;
              if (video.src !== "https://drive.usercontent.google.com/download?id=1KAe25bw1wvhyvI1-KPOs0eOYrvDWjhvD&export=download") {
                video.src = "https://drive.usercontent.google.com/download?id=1KAe25bw1wvhyvI1-KPOs0eOYrvDWjhvD&export=download";
                video.load();
              }
            }}
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Cinematic study scene"
          />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(0,0,0,0.45)_70%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-[#060607]" />

          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(0, ${heroTranslate}px, 0) scale(${heroScale})`,
              transition: "transform 120ms linear",
            }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-12 pt-8 sm:px-10 lg:px-16">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-200/80">LERNARCHIV</p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-300">
                  <span className={cn("h-2 w-2 rounded-full", storageMode === "cloud" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                  {storageMode === "cloud" ? "Cloud Sync (R2 + Postgres)" : "Local Storage"}
                </span>
                <p className="hidden text-xs text-zinc-300/75 sm:block">Fachinformatiker Systemintegration</p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-zinc-200 transition hover:border-[#b9a066] hover:text-white"
                  >
                    Abmelden
                  </button>
                ) : null}
              </div>
            </header>

            <div className="max-w-4xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#d7c289]">EINE WOCHE. EIN SCHRITT.</p>
              <h1 className="mt-4 text-[clamp(2rem,7vw,4.8rem)] font-semibold leading-[1.05] text-white">
                Aus jedem Schritt entsteht Fortschritt.
              </h1>
              <p className="mt-5 max-w-2xl text-sm tracking-wide text-zinc-200/80 sm:text-base">
                Wissen wird zu Können.
              </p>
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4"
            style={{
              opacity: isAuthenticated ? 0 : loginReveal,
              transform: `translateY(${(1 - loginReveal) * 26}px)`,
              transition: "opacity 450ms ease, transform 450ms ease",
            }}
          >
            <form
              onSubmit={handleLogin}
              autoComplete="off"
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/20 bg-[#0d0f14]/65 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Sicherer Zugang</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Anmeldung</h2>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Benutzername</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Benutzername eingeben..."
                    className="w-full rounded-xl border border-white/15 bg-[#12141c]/80 px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Passwort</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Passwort eingeben..."
                    className="w-full rounded-xl border border-white/15 bg-[#12141c]/80 px-4 py-3 text-zinc-100 outline-none transition focus:border-[#b9a066]"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              {loginError ? <p className="mt-3 text-sm text-red-300">{loginError}</p> : null}

              <button
                type="submit"
                className="mt-5 w-full rounded-xl bg-[#b9a066] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#ceb57a]"
              >
                Anmelden
              </button>
            </form>
          </div>
        </div>
      </section>

      <section
        ref={dashboardRef}
        className={cn(
          "relative z-30 mx-auto w-full max-w-7xl px-4 pb-16 pt-8 transition-all duration-700 sm:px-8",
          isAuthenticated ? "opacity-100 translate-y-0" : "pointer-events-none opacity-40 blur-[1px]",
        )}
      >
        <header className="sticky top-0 z-40 mb-8 rounded-2xl border border-white/10 bg-[#090a0d]/85 px-5 py-4 backdrop-blur-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">LERNARCHIV</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">Mein Lernarchiv</h2>
              <p className="text-xs text-zinc-400">Meine Umschulung · Fachinformatiker Systemintegration</p>
            </div>
            <nav className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="rounded-full border border-white/15 px-3 py-1">Übersicht</span>
              <span className="rounded-full border border-white/15 px-3 py-1">Lektionen</span>
              <span className="rounded-full border border-white/15 px-3 py-1">Dateien</span>
            </nav>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-zinc-200">Admin</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-zinc-200 transition hover:border-[#b9a066] hover:text-white"
              >
                Abmelden
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Gespeicherte Wochen", value: stats.weeks },
            { label: "Lektionen", value: stats.lessons },
            { label: "Dateien", value: stats.files },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-white/10 bg-[#0b0d11] p-5">
              <p className="text-3xl font-semibold text-white">{item.value}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400">{item.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            onClick={() => {
              setEditingLesson(null);
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-[#b9a066] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#ceb57a]"
          >
            + Lektion hinzufügen
          </button>

          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:ml-6 lg:grid-cols-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Lektionen durchsuchen …"
              className="rounded-xl border border-white/10 bg-[#0f1218] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-[#b9a066] sm:col-span-2"
            />
            <select
              value={filterField}
              onChange={(event) => setFilterField(event.target.value as FilterField)}
              className="rounded-xl border border-white/10 bg-[#0f1218] px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9a066]"
            >
              <option value="all">Alle Felder</option>
              <option value="week">Woche</option>
              <option value="date">Datum</option>
              <option value="title">Thema</option>
              <option value="description">Beschreibung</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-xl border border-white/10 bg-[#0f1218] px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9a066]"
            >
              <option value="newest">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="week-asc">Woche aufsteigend</option>
              <option value="week-desc">Woche absteigend</option>
            </select>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#0b0d11] p-3 sm:p-5">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-zinc-400">Lade Lektionen …</p>
          ) : filteredLessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-6 py-14 text-center">
              <h3 className="text-xl font-semibold text-zinc-100">Noch keine Lektionen gespeichert</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
                Beginne damit, deine erste Unterrichtswoche zu dokumentieren.
              </p>
              <button
                onClick={() => {
                  setEditingLesson(null);
                  setShowModal(true);
                }}
                className="mt-6 rounded-xl bg-[#b9a066] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#ceb57a]"
                type="button"
              >
                + Erste Lektion hinzufügen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                    <th className="px-3 py-2">Woche</th>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Lesson / Thema</th>
                    <th className="px-3 py-2">Datei</th>
                    <th className="px-3 py-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map((lesson) => (
                    <tr
                      key={lesson.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] text-sm text-zinc-200 transition hover:bg-white/[0.05]"
                    >
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-lg border border-[#b9a066]/40 bg-[#b9a066]/10 px-2 py-1 text-xs font-semibold text-[#dbc282]">
                          Woche {lesson.week}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-zinc-300">{formatDateGerman(lesson.date)}</td>
                      <td className="px-3 py-3">{lesson.title}</td>
                      <td className="px-3 py-3 text-zinc-300">
                        {lesson.files.length > 0
                          ? `${lesson.files.length} · ${lesson.files
                              .slice(0, 2)
                              .map((file) => fileExtension(file.name))
                              .join(", ")}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setSelectedLesson(lesson)}
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs transition hover:border-[#b9a066]"
                            type="button"
                          >
                            Öffnen
                          </button>
                          <button
                            onClick={() => {
                              setEditingLesson(lesson);
                              setShowModal(true);
                            }}
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs transition hover:border-white/35"
                            type="button"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => setDeleteTarget(lesson)}
                            className="rounded-lg border border-red-400/45 px-3 py-1.5 text-xs text-red-200 transition hover:border-red-400/80"
                            type="button"
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <LessonModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={saveLesson}
        initial={editingLesson}
      />

      {selectedLesson ? <LessonDetails lesson={selectedLesson} onClose={() => setSelectedLesson(null)} /> : null}

      <DeleteDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await removeLesson(deleteTarget.id);
        }}
      />
    </main>
  );
}
