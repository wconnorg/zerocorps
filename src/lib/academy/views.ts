import type { Checkpoint } from "./content.ts";
import { renderInline } from "./markdown.ts";

/**
 * What the checkpoint page may send to the browser: each question and its options, as
 * HTML, and nothing else. Not which option is right, not what to reread: those stay on
 * the server, which grades the answers (`progress.ts`). A test holds this to that.
 */
export function publicQuestions(
  checkpoint: Checkpoint,
): { questionHtml: string; optionsHtml: string[] }[] {
  return checkpoint.questions.map((question) => ({
    questionHtml: renderInline(question.question),
    optionsHtml: question.options.map((option) => renderInline(option)),
  }));
}
