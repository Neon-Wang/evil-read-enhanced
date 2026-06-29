/**
 * @file file-header-banner.js
 * @description ESLint rule enforcing the v1 `@file` / `@description`
 * JSDoc banner at the top of every source file.
 *
 * The banner is the single most valuable signal for AI coding agents
 * that open a file mid-task: it lets the agent decide in 5 lines
 * whether to keep reading or move on, without scanning the whole
 * file. This rule therefore treats banner presence as a hard `error`,
 * not a style suggestion.
 *
 * Rules:
 *   - The first JSDoc block comment (`/** ... *\/`) in the file MUST
 *     appear before any code (i.e. above all program-body nodes).
 *     Leading line comments (e.g. `// @eikon:feature(supabase) file`)
 *     are tolerated and skipped over.
 *   - The banner MUST contain `@file`.
 *   - The banner MUST contain `@description` with non-trivial text
 *     (default minimum: 10 characters after collapsing whitespace).
 *
 * Schema option:
 *   - `minDescription` (number, default 10) — minimum visible chars
 *     in the `@description` body.
 */

const meta = {
  type: 'suggestion',
  docs: {
    description:
      'Require every source file to start with /** @file ... @description ... */ JSDoc banner',
  },
  messages: {
    missing:
      'File must start with a JSDoc banner: /** @file <name> @description <text> */',
    bannerAfterCode:
      'JSDoc banner must appear before all code in the file (only leading line comments are allowed above it).',
    missingFileTag: 'JSDoc banner must include an `@file` tag.',
    missingDescTag:
      'JSDoc banner must include an `@description` tag with non-empty body.',
    shortDescTag:
      '@description body is too short ({{actual}} chars); expected at least {{min}}.',
  },
  schema: [
    {
      type: 'object',
      properties: {
        minDescription: { type: 'number', minimum: 0 },
      },
      additionalProperties: false,
    },
  ],
};

function findBanner(comments) {
  return comments.find((c) => c.type === 'Block' && c.value.startsWith('*'));
}

function extractDescription(value) {
  // Capture from `@description` up to the next `@tag` line or end of comment.
  const m = value.match(/@description\b([\s\S]*?)(?=\n\s*\*\s*@\w+|$)/);
  if (!m) return null;
  // Strip leading `*` markers from each subsequent line, collapse blanks.
  return m[1]
    .replace(/^\s*\*\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const rule = {
  meta,
  create(context) {
    const opts = context.options[0] || {};
    const minDesc = typeof opts.minDescription === 'number' ? opts.minDescription : 10;
    return {
      Program(node) {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const comments = sourceCode.getAllComments();
        const banner = findBanner(comments);

        if (!banner) {
          context.report({ node, messageId: 'missing' });
          return;
        }

        if (node.body.length > 0) {
          const firstNode = node.body[0];
          if (banner.range[0] > firstNode.range[0]) {
            context.report({ node: banner, messageId: 'bannerAfterCode' });
            return;
          }
        }

        const txt = banner.value;
        if (!/@file\b/.test(txt)) {
          context.report({ node: banner, messageId: 'missingFileTag' });
        }

        const desc = extractDescription(txt);
        if (desc === null || desc.length === 0) {
          context.report({ node: banner, messageId: 'missingDescTag' });
        } else if (desc.length < minDesc) {
          context.report({
            node: banner,
            messageId: 'shortDescTag',
            data: { actual: String(desc.length), min: String(minDesc) },
          });
        }
      },
    };
  },
};

export default rule;
