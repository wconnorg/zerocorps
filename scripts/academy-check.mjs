// npm run academy:check
//
// Reads content/academy/ exactly as the site does and says whether it is ready: how many
// lessons are written and how many are still drafts, or every problem with its file, so
// the owner can fix them in Obsidian. It reads only the lesson folder: no database, no
// secrets, nothing from .env.local.

import { loadCatalog, ContentError } from "../src/lib/academy/content.ts";

try {
  const catalog = loadCatalog("content/academy");
  const lessons = [...catalog.lessons.values()];
  const written = lessons.filter((lesson) => !lesson.draft).length;
  const checkpoints = [...catalog.chapters.values()].filter((chapter) => chapter.checkpoint).length;
  console.log("The lesson folder is ready.");
  console.log(
    `  ${catalog.courses.length} courses, ${catalog.chapters.size} chapters, ${lessons.length} lessons: ` +
      `${written} written, ${lessons.length - written} still drafts.`,
  );
  console.log(`  ${checkpoints} chapter(s) have a checkpoint.`);
  for (const course of catalog.courses) {
    const count = course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
    const soon = course.comingSoon ? " (coming soon)" : "";
    console.log(`  Level ${course.level}: ${course.title}${soon}, ${count} lessons`);
  }
} catch (error) {
  if (!(error instanceof ContentError)) throw error;
  console.error(`The lesson folder has ${error.problems.length} problem(s) to fix:`);
  for (const problem of error.problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}
