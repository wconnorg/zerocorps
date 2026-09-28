import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Catalog } from "@/lib/academy/content";
import type { MemberAcademy } from "@/lib/academy/member";
import { standing } from "@/lib/academy/standing";
import { publicQuestions } from "@/lib/academy/views";
import { buildCatalog, TWO_QUESTIONS } from "@/test/academy-fixture";
import { AcademyHome, Heatmap } from "./academy-home";
import { ChapterView } from "./chapter-view";

/**
 * The Academy's pages, drawn from plain values: no session, no database, no browser. The
 * pages decide who may see them; these check what is drawn.
 */

const ACADEMY = buildCatalog({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }, { id: "m2" }] },
        { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
        { id: "tools", lessons: [{ id: "t1", draft: true }] },
      ],
    },
    { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
    {
      id: "sierra",
      level: 2,
      comingSoon: true,
      chapters: [{ id: "sierra-setup", lessons: [{ id: "s1" }] }],
    },
  ],
});

function member(catalog: Catalog, completed: string[] = [], passed: string[] = []): MemberAcademy {
  const s = standing(catalog, new Set(completed), new Set(passed));
  return {
    userId: "u",
    username: "trader_99",
    catalog,
    standing: s,
    completed: new Set(completed),
    passed: new Set(passed),
    steps: new Map(s.earnedSteps.map((step) => [step, null])),
  };
}

const home = (academy: MemberAcademy) =>
  renderToStaticMarkup(<AcademyHome academy={academy} activity={new Map()} />);

describe("the Academy's home", () => {
  it("has one heading, the Rookie rank, and both levels by their names", () => {
    const html = home(member(ACADEMY));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Rookie");
    expect(html).toContain("Foundations");
    expect(html).toContain("The Platform");
    expect(html).toContain("Education only. Nothing in the Academy is financial advice.");
  });

  it("Continue leads to the first open lesson not done, then to a checkpoint that is ready", () => {
    expect(home(member(ACADEMY, ["m1"]))).toContain('href="/academy/markets/m2"');
    const ready = home(member(ACADEMY, ["m1", "m2", "r1"]));
    expect(ready).toContain('href="/academy/risk/checkpoint"');
    expect(ready).toContain("Take the checkpoint");
  });

  it("says the first lessons are on the way when nothing is open yet", () => {
    const drafts = buildCatalog({
      courses: [
        {
          id: "foundations",
          level: 1,
          chapters: [{ id: "markets", lessons: [{ id: "m1", draft: true }] }],
        },
      ],
    });
    const html = home(member(drafts));
    expect(html).toContain("The first lessons are being written");
    expect(html).not.toContain('href="/academy/markets');
  });

  it("a chapter with nothing open, and a course that is coming soon, are shown but never linked", () => {
    const html = home(member(ACADEMY));
    expect(html).toContain("COMING SOON");
    expect(html).not.toContain('href="/academy/tools"');
    expect(html).not.toContain('href="/academy/sierra-setup"');
    expect(html).toContain('href="/academy/setup"');
  });

  it("a finished level lights a segment of the rank and says so", () => {
    const written = buildCatalog({
      courses: [
        { id: "foundations", level: 1, chapters: [{ id: "markets", lessons: [{ id: "m1" }] }] },
      ],
    });
    const html = home(member(written, ["m1"]));
    expect(html).toContain("Levels 1 of 3");
    expect(html).toMatch(/Level 1 · Foundations<\/span><span[^>]*>COMPLETE/);
  });

  it("escapes whatever the lesson files say", () => {
    const hostile = buildCatalog({
      courses: [
        { id: "foundations", level: 1, chapters: [{ id: "markets", lessons: [{ id: "m1" }] }] },
      ],
    });
    hostile.chapters.get("markets")!.title = '"><img src=x onerror=alert(1)>';
    const html = home(member(hostile));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("the activity heatmap", () => {
  it("counts lessons and days, and says so to a screen reader", () => {
    const today = new Date().toISOString().slice(0, 10);
    const html = renderToStaticMarkup(<Heatmap activity={new Map([[today, 3]])} />);
    expect(html).toContain('aria-label="3 lessons completed on 1 days in the last 26 weeks"');
    expect(html).toContain(`title="${today}: 3 lessons"`);
  });
});

describe("a chapter's page", () => {
  it("links the open lessons only, and keeps the checkpoint locked until they are done", () => {
    const html = renderToStaticMarkup(<ChapterView academy={member(ACADEMY)} chapterId="risk" />);
    expect(html).toContain('href="/academy/risk/r1"');
    expect(html).toContain("Opens when every lesson in this chapter is complete.");
    expect(html).not.toContain('href="/academy/risk/checkpoint"');
  });

  it("opens the checkpoint once the lessons are done, and says passed once it is", () => {
    const ready = renderToStaticMarkup(
      <ChapterView academy={member(ACADEMY, ["r1"])} chapterId="risk" />,
    );
    expect(ready).toContain('href="/academy/risk/checkpoint"');
    const passed = renderToStaticMarkup(
      <ChapterView academy={member(ACADEMY, ["r1"], ["risk"])} chapterId="risk" />,
    );
    expect(passed).toContain("PASSED");
  });

  it("shows a draft as coming soon, never as a link", () => {
    const html = renderToStaticMarkup(<ChapterView academy={member(ACADEMY)} chapterId="tools" />);
    expect(html).toContain("COMING SOON");
    expect(html).not.toContain('href="/academy/tools/t1"');
  });
});

describe("what the checkpoint page sends to the browser", () => {
  it("the questions and options only: never which option is right, never what to reread", () => {
    const view = publicQuestions(TWO_QUESTIONS);
    expect(view).toEqual([
      { questionHtml: "First?", optionsHtml: ["wrong", "right", "wrong"] },
      { questionHtml: "Second?", optionsHtml: ["right", "wrong"] },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/correct|reread|"m1"/);
  });
});
