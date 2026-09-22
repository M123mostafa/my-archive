import { db } from "@/db";
import { lessonFiles, lessons } from "@/db/schema";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let tablesInitialized = false;

async function ensureTables() {
  if (tablesInitialized || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        week INTEGER NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lesson_files (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        last_modified INTEGER,
        r2_key TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    tablesInitialized = true;
  } catch (err) {
    console.error("Error ensuring DB tables exist:", err);
  }
}

export async function GET() {
  // Option 1: Drizzle ORM via DATABASE_URL
  if (db) {
    try {
      await ensureTables();
      const allLessons = await db.select().from(lessons).orderBy(desc(lessons.updatedAt));
      const allFiles = await db.select().from(lessonFiles);

      const result = allLessons.map((lesson) => {
        const filesForLesson = allFiles
          .filter((file) => file.lessonId === lesson.id)
          .map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            lastModified: f.lastModified ?? Date.now(),
            r2Key: f.r2Key,
            url: f.url,
          }));

        return {
          ...lesson,
          files: filesForLesson,
        };
      });

      return NextResponse.json({ ok: true, mode: "cloud", lessons: result });
    } catch (error) {
      console.error("Drizzle GET /api/lessons error:", error);
    }
  }

  // Option 2: Supabase SDK
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: fetchedLessons, error: lessonsErr } = await supabase
        .from("lessons")
        .select("*")
        .order("updatedAt", { ascending: false });

      if (lessonsErr) {
        console.warn("Supabase fetch warning:", lessonsErr.message);
        return NextResponse.json({ ok: true, mode: "cloud", lessons: [] });
      }

      const { data: fetchedFiles } = await supabase.from("lesson_files").select("*");
      const filesList = fetchedFiles || [];

      const result = (fetchedLessons || []).map((lesson: any) => ({
        ...lesson,
        files: filesList
          .filter((f: any) => f.lesson_id === lesson.id || f.lessonId === lesson.id)
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            lastModified: f.last_modified || f.lastModified || Date.now(),
            r2Key: f.r2_key || f.r2Key || "",
            url: f.url,
          })),
      }));

      return NextResponse.json({ ok: true, mode: "cloud", lessons: result });
    } catch (error) {
      console.error("Supabase GET /api/lessons error:", error);
    }
  }

  return NextResponse.json({ ok: true, mode: "client-only", lessons: [] });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const id = (formData.get("id") as string) || crypto.randomUUID();
  const week = Number(formData.get("week"));
  const date = formData.get("date") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const existingFilesJson = (formData.get("existingFiles") as string) || "[]";
  const createdAt = (formData.get("createdAt") as string) || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  if (!week || !date || !title || !description) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Process new files
  const newFiles = formData.getAll("newFiles") as File[];
  const uploadedRecords = [];

  for (const file of newFiles) {
    if (!(file instanceof File) || file.size === 0) continue;

    const fileId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const r2Key = `lessons/${id}/${fileId}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let url = `/api/files/${r2Key}`;
    if (isR2Configured()) {
      url = await uploadToR2(buffer, r2Key, file.type || "application/octet-stream");
    } else {
      // Data URL fallback if R2 is not configured yet
      const base64 = buffer.toString("base64");
      url = `data:${file.type || "application/octet-stream"};base64,${base64}`;
    }

    uploadedRecords.push({
      id: fileId,
      lessonId: id,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      r2Key,
      url,
      createdAt: new Date().toISOString(),
    });
  }

  let keptFiles: Array<{ id: string; name: string; type: string; size: number; r2Key: string; url: string }> = [];
  try {
    keptFiles = JSON.parse(existingFilesJson);
  } catch {
    keptFiles = [];
  }

  // Save via Drizzle
  if (db) {
    try {
      await ensureTables();
      const existingLessonList = await db.select().from(lessons).where(eq(lessons.id, id));
      const isUpdate = existingLessonList.length > 0;

      if (isUpdate) {
        await db
          .update(lessons)
          .set({ week, date, title, description, updatedAt })
          .where(eq(lessons.id, id));
      } else {
        await db.insert(lessons).values({
          id,
          week,
          date,
          title,
          description,
          createdAt,
          updatedAt,
        });
      }

      if (isUpdate) {
        const currentDbFiles = await db.select().from(lessonFiles).where(eq(lessonFiles.lessonId, id));
        const keptIds = new Set(keptFiles.map((f) => f.id));

        for (const dbFile of currentDbFiles) {
          if (!keptIds.has(dbFile.id)) {
            if (isR2Configured() && dbFile.r2Key) {
              await deleteFromR2(dbFile.r2Key);
            }
            await db.delete(lessonFiles).where(eq(lessonFiles.id, dbFile.id));
          }
        }
      }

      for (const rec of uploadedRecords) {
        await db.insert(lessonFiles).values(rec);
      }

      const finalFiles = await db.select().from(lessonFiles).where(eq(lessonFiles.lessonId, id));

      return NextResponse.json({
        ok: true,
        lesson: {
          id,
          week,
          date,
          title,
          description,
          createdAt,
          updatedAt,
          files: finalFiles.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            lastModified: f.lastModified,
            r2Key: f.r2Key,
            url: f.url,
          })),
        },
      });
    } catch (err) {
      console.error("Drizzle POST error:", err);
    }
  }

  // Save via Supabase Client
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("lessons").upsert({
        id,
        week,
        date,
        title,
        description,
        createdAt,
        updatedAt,
      });

      for (const rec of uploadedRecords) {
        await supabase.from("lesson_files").upsert({
          id: rec.id,
          lesson_id: rec.lessonId,
          name: rec.name,
          type: rec.type,
          size: rec.size,
          last_modified: rec.lastModified,
          r2_key: rec.r2Key,
          url: rec.url,
          created_at: rec.createdAt,
        });
      }

      const allFiles = [...keptFiles, ...uploadedRecords];

      return NextResponse.json({
        ok: true,
        lesson: {
          id,
          week,
          date,
          title,
          description,
          createdAt,
          updatedAt,
          files: allFiles,
        },
      });
    } catch (err) {
      console.error("Supabase POST error:", err);
    }
  }

  return NextResponse.json(
    { ok: false, error: "Database not configured." },
    { status: 400 },
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing lesson ID" }, { status: 400 });
  }

  if (db) {
    try {
      await ensureTables();
      const filesToDelete = await db.select().from(lessonFiles).where(eq(lessonFiles.lessonId, id));

      for (const file of filesToDelete) {
        if (isR2Configured() && file.r2Key) {
          await deleteFromR2(file.r2Key);
        }
      }

      await db.delete(lessons).where(eq(lessons.id, id));

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Drizzle DELETE error:", err);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: filesToDelete } = await supabase
        .from("lesson_files")
        .select("*")
        .eq("lesson_id", id);

      for (const file of filesToDelete || []) {
        if (isR2Configured() && (file.r2_key || file.r2Key)) {
          await deleteFromR2(file.r2_key || file.r2Key);
        }
      }

      await supabase.from("lesson_files").delete().eq("lesson_id", id);
      await supabase.from("lessons").delete().eq("id", id);

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Supabase DELETE error:", err);
    }
  }

  return NextResponse.json(
    { ok: false, error: "Database not configured." },
    { status: 400 },
  );
}
