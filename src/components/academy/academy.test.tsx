import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Catalog } from "@/lib/academy/content";
import type { MemberAcademy } from "@/lib/academy/member";
import { standing } from "@/lib/academy/standing";
import { publicQuestions } from "@/lib/academy/views";
import { buildCatalog, TWO_QUESTIONS } from "@/test/academy-fixture";
import { AcademyHome } from "./academy-home";
import { AcademyTabs } from "./academy-tabs";
import { ChapterView } from "./chapter-view";
import { Heatmap, ProgressView } from "./progress-view";

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

function member(
  catalog: Catalog,
  completed: string[] = [],
  passed: string[] = [],
  discord = { linked: true, available: true },
): MemberAcademy {
  const s = standing(catalog, new Set(completed), new Set(passed));
  return {
    userId: "u",
    username: "trader_99",
    catalog,
    standing: s,
    completed: new Set(completed),
    passed: new Set(passed),
    steps: new Map(s.earnedSteps.map((step) => [step, null])),
    discord,
  };
}

const home = (academy: MemberAcademy) => renderToStaticMarkup(<AcademyHome academy={academy} />);
const progress = (academy: MemberAcademy) =>
  renderToStaticMarkup(<ProgressView academy={academy} activity={new Map()} />);

/** Both levels fully written, so Bronze can be earned. */
const BOTH = buildCatalog({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }, { id: "m2" }] },
        { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
      ],
    },
    { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
  ],
});
const EVERYTHING = ["m1", "m2", "r1", "q1"];

describe("the Academy's home (the Learn tab)", () => {
  it("has one heading, both levels by their names, and Resume", () => {
    const html = home(member(ACADEMY, ["m1"]));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Fundamentals");
    expect(html).toContain("Order Flow Software");
    expect(html).toContain("Resume");
    expect(html).not.toMatch(/Rookie/i);
    expect(html).toContain("Education only. Nothing in the Academy is financial advice.");
  });

  it("leaves the rank, the member's progress and the activity to the Progress tab", () => {
    const html = home(member(BOTH, EVERYTHING, ["risk"]));
    expect(html).not.toContain('aria-label="Your rank"');
    expect(html).not.toContain("No rank yet");
    expect(html).not.toContain("YOUR RECORD");
    expect(html).not.toContain("YOUR PROGRESS");
    expect(html).not.toContain("ACTIVITY");
    expect(html).not.toContain('role="img"');
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

  it("each level has an anchor the chapter pages' trail leads back to", () => {
    const html = home(member(ACADEMY));
    expect(html).toContain('id="level-1"');
    expect(html).toContain('id="level-2"');
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

describe("the Progress tab", () => {
  it("has one heading, the Bronze rank, Your progress (no longer Your record) and a year of activity", () => {
    const html = progress(member(ACADEMY));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Your rank"');
    expect(html).toContain("Bronze");
    expect(html).toContain("YOUR PROGRESS");
    expect(html).not.toContain("YOUR RECORD");
    expect(html).toContain("ACTIVITY");
    expect(html).toContain("in the last 52 weeks");
    expect(html).not.toMatch(/Rookie/i);
    expect(html).toContain('href="/academy/ranks"');
  });

  it("counts lessons against the open ones, and checkpoints passed", () => {
    const text = progress(member(ACADEMY, ["m1", "r1"], ["risk"])).replace(/<[^>]+>/g, "");
    expect(text).toContain("Lessons completed2 / 4");
    expect(text).toContain("Checkpoints passed1");
  });

  it("a finished level lights a segment of the rank and says so", () => {
    const written = buildCatalog({
      courses: [
        { id: "foundations", level: 1, chapters: [{ id: "markets", lessons: [{ id: "m1" }] }] },
      ],
    });
    const html = progress(member(written, ["m1"]));
    expect(html).toContain("Levels 1 of 2");
    expect(html).toMatch(/Level 1 · Fundamentals<\/span><span[^>]*>COMPLETE/);
  });

  it("before both levels are finished: no rank yet, and how to earn Bronze", () => {
    const oneLevel = progress(member(BOTH, ["m1", "m2", "r1"], ["risk"]));
    expect(oneLevel).toContain("No rank yet");
    expect(oneLevel).toContain("Finish both levels, every chapter and its checkpoint");
    expect(oneLevel).toContain("Levels 1 of 2");
    const bronze = progress(member(BOTH, EVERYTHING, ["risk"]));
    expect(bronze).toContain("Current rank");
    expect(bronze).not.toContain("No rank yet");
    expect(bronze).toContain("Levels 2 of 2");
  });

  it("an earned rank is claimed by linking Discord: until then the page says how", () => {
    const unlinked = progress(
      member(BOTH, EVERYTHING, ["risk"], { linked: false, available: true }),
    );
    expect(unlinked).toContain("Rank earned");
    expect(unlinked).not.toContain("Current rank");
    expect(unlinked).toContain('href="/settings#connections"');
    expect(unlinked).toContain("to claim it");

    const notOpenYet = progress(
      member(BOTH, EVERYTHING, ["risk"], { linked: false, available: false }),
    );
    expect(notOpenYet).toContain("once Discord linking opens");
    expect(notOpenYet).not.toContain('href="/settings#connections"');

    const linked = progress(member(BOTH, EVERYTHING, ["risk"], { linked: true, available: true }));
    expect(linked).toContain("Current rank");
    expect(linked).not.toContain("to claim it");
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

describe("the Academy's tabs", () => {
  it("lead to Learn, Progress and Ranks, and mark the page you are on", () => {
    const html = renderToStaticMarkup(<AcademyTabs current="progress" />);
    expect(html).toContain('aria-label="Academy"');
    expect(html).toContain('href="/academy"');
    expect(html).toContain('href="/academy/progress"');
    expect(html).toContain('href="/academy/ranks"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const current = html.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(current).toContain('href="/academy/progress"');
  });
});

describe("a chapter's page", () => {
  it("its trail is branded ZeroCorps Academy, and each step before the chapter leads back", () => {
    const html = renderToStaticMarkup(<ChapterView academy={member(ACADEMY)} chapterId="risk" />);
    expect(html).toMatch(
      /<a [^>]*href="\/academy"[^>]*><span class="text-fg">Zero<\/span><span class="text-accent">Corps<\/span> Academy<\/a>/,
    );
    expect(html).toMatch(/<a [^>]*href="\/academy#level-1"[^>]*>Level 01 · Fundamentals<\/a>/);
    expect(html).toMatch(/aria-current="page"[^>]*>Chapter 02</);
  });

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
