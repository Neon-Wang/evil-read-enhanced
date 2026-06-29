/**
 * @file glob-match.js
 * @description Tiny glob-to-regex matcher used by the local ESLint plugin.
 *
 * Bundled instead of pulling in `micromatch` / `picomatch` so the eslint
 * plugin has zero npm dependencies (it ships inside the template and is
 * loaded by every consumer's eslint.config.js). Supports the subset of
 * glob syntax actually used by the rule configs:
 *
 *   - `**`       — zero or more path segments (greedy across `/`)
 *   - `*`        — zero or more chars within a single segment
 *   - `?`        — exactly one char within a single segment
 *   - `{a,b,c}`  — flat alternation (no nesting, no commas inside)
 *
 * Paths are expected to use forward slashes; callers normalise OS paths
 * before passing them in.
 */

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

export function globToRegex(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];

    if (c === '*' && glob[i + 1] === '*') {
      // `**` matches any chars including `/`. When followed by `/`, collapse
      // both so `a/**/b` matches `a/b` (zero intermediate segments).
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 3;
      } else {
        re += '.*';
        i += 2;
      }
      continue;
    }

    if (c === '*') {
      re += '[^/]*';
      i++;
      continue;
    }

    if (c === '?') {
      re += '[^/]';
      i++;
      continue;
    }

    if (c === '{') {
      const close = glob.indexOf('}', i);
      if (close === -1) {
        re += escapeRegex(c);
        i++;
        continue;
      }
      const alts = glob.slice(i + 1, close).split(',');
      const altSources = alts.map((a) => {
        const sub = globToRegex(a).source;
        return sub.replace(/^\^/, '').replace(/\$$/, '');
      });
      re += '(?:' + altSources.join('|') + ')';
      i = close + 1;
      continue;
    }

    re += escapeRegex(c);
    i++;
  }
  return new RegExp('^' + re + '$');
}

export function globMatch(glob, p) {
  return globToRegex(glob).test(p);
}
