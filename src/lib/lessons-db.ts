import { openDB, type DBSchema } from "idb";

export type StoredFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  data?: Blob;
  url?: string;
  r2Key?: string;
  fileInstance?: File;
};

export type LessonRecord = {
  id: string;
  week: number;
  date: string;
  title: string;
  description: string;
  files: StoredFile[];
  createdAt: string;
  updatedAt: string;
};

type LessonInput = {
  week: number;
  date: string;
  title: string;
  description: string;
  files: StoredFile[];
};

interface LearningArchiveDB extends DBSchema {
  lessons: {
    key: string;
    value: LessonRecord;
    indexes: {
      "by-week": number;
      "by-date": string;
      "by-updatedAt": string;
    };
  };
}

const DB_NAME = "learning-archive-db";
const DB_VERSION = 1;

let dbPromise: Promise<import("idb").IDBPDatabase<LearningArchiveDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }

  if (!dbPromise) {
    dbPromise = openDB<LearningArchiveDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("lessons")) {
          const store = db.createObjectStore("lessons", { keyPath: "id" });
          store.createIndex("by-week", "week");
          store.createIndex("by-date", "date");
          store.createIndex("by-updatedAt", "updatedAt");
        }
      },
    });
  }

  return dbPromise;
}

export async function getAllLessons(): Promise<LessonRecord[]> {
  const db = await getDb();
  const lessons = await db.getAll("lessons");
  return lessons.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createLesson(input: LessonInput): Promise<LessonRecord> {
  const db = await getDb();
  const now = new Date().toISOString();

  const record: LessonRecord = {
    id: crypto.randomUUID(),
    week: input.week,
    date: input.date,
    title: input.title,
    description: input.description,
    files: input.files,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("lessons", record);
  return record;
}

export async function updateLesson(
  id: string,
  input: LessonInput,
  createdAt: string,
): Promise<LessonRecord> {
  const db = await getDb();
  const now = new Date().toISOString();

  const record: LessonRecord = {
    id,
    week: input.week,
    date: input.date,
    title: input.title,
    description: input.description,
    files: input.files,
    createdAt,
    updatedAt: now,
  };

  await db.put("lessons", record);
  return record;
}

export async function deleteLesson(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("lessons", id);
}

export async function filesFromList(fileList: FileList | null): Promise<StoredFile[]> {
  if (!fileList) return [];

  const files = Array.from(fileList);

  return files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
    data: file,
    fileInstance: file,
  }));
}
