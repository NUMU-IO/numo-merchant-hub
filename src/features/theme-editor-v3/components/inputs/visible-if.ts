/**
 * visible_if — small predicate evaluator for conditional settings.
 *
 * Theme authors annotate a setting with a `visible_if` expression that
 * references other setting IDs in the same schema:
 *
 *   {
 *     id: "background_image",
 *     type: "image_picker",
 *     visible_if: "settings.use_background == true"
 *   }
 *
 * Two flavors are supported:
 *
 *   1. **String DSL** — minimal expression grammar (`==`, `!=`, `&&`,
 *      `||`, parentheses, string/number/boolean literals,
 *      `settings.<id>` references). Easy to write in JSON; Shopify-style.
 *
 *   2. **Object form** — `{ "use_background": true }` shorthand for
 *      `settings.use_background == true`. Also accepts arrays for "in"
 *      semantics: `{ "alignment": ["left", "right"] }`.
 *
 * Returns `true` when the setting should be visible. Defaults to `true`
 * (no `visible_if` → always visible) and falls back to `true` on any
 * parse failure so a syntax error doesn't hide everything in the panel.
 */

export type VisibleIfShape =
  | string
  | Record<string, unknown>
  | undefined
  | null;

export function evaluateVisibleIf(
  expr: VisibleIfShape,
  values: Record<string, unknown>,
): boolean {
  if (expr == null) return true;
  if (typeof expr === "object") return evaluateObjectForm(expr, values);
  if (typeof expr === "string") {
    try {
      return evaluateStringExpr(expr, values);
    } catch {
      // Bad syntax → render rather than hide. Hiding silently on a
      // typo would be confusing (the merchant sees a missing setting
      // with no error).
      return true;
    }
  }
  return true;
}

function evaluateObjectForm(
  expr: Record<string, unknown>,
  values: Record<string, unknown>,
): boolean {
  // All keys ANDed together; each value can be a literal (== check) or
  // an array (in check).
  for (const [key, expected] of Object.entries(expr)) {
    const actual = values[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else {
      // eslint-disable-next-line eqeqeq
      if (actual != expected) return false;
    }
  }
  return true;
}

// ── String DSL ──────────────────────────────────────────────────────────────
//
// Tokens: identifiers (settings.*), string literals ("..." / '...'),
// number literals, boolean literals (true/false), null, operators
// (==, !=, &&, ||, !, parentheses).
//
// Recursive-descent parser with operator precedence:
//   expression  := orExpr
//   orExpr      := andExpr ('||' andExpr)*
//   andExpr     := comparison ('&&' comparison)*
//   comparison  := unary (('=='|'!=') unary)?
//   unary       := '!' unary | atom
//   atom        := literal | reference | '(' expression ')'
//
// We don't allow function calls or arbitrary attribute access — tight
// grammar keeps the eval safe (no Function() / eval anywhere).

function evaluateStringExpr(
  expr: string,
  values: Record<string, unknown>,
): boolean {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  const ast = parser.parseExpression();
  if (!parser.isAtEnd()) {
    throw new Error("trailing tokens");
  }
  return Boolean(evalNode(ast, values));
}

type Token =
  | { type: "ident"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "null" }
  | { type: "op"; value: "==" | "!=" | "&&" | "||" | "!" | "(" | ")" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ type: "op", value: c as "(" | ")" });
      i++;
      continue;
    }
    if (c === "!" && input[i + 1] === "=") {
      tokens.push({ type: "op", value: "!=" });
      i += 2;
      continue;
    }
    if (c === "=" && input[i + 1] === "=") {
      tokens.push({ type: "op", value: "==" });
      i += 2;
      continue;
    }
    if (c === "&" && input[i + 1] === "&") {
      tokens.push({ type: "op", value: "&&" });
      i += 2;
      continue;
    }
    if (c === "|" && input[i + 1] === "|") {
      tokens.push({ type: "op", value: "||" });
      i += 2;
      continue;
    }
    if (c === "!") {
      tokens.push({ type: "op", value: "!" });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let buf = "";
      while (j < input.length && input[j] !== quote) {
        if (input[j] === "\\" && j + 1 < input.length) {
          buf += input[j + 1];
          j += 2;
        } else {
          buf += input[j];
          j++;
        }
      }
      if (j === input.length) throw new Error("unterminated string");
      tokens.push({ type: "string", value: buf });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      if (input[j] === "-") j++;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "number", value: parseFloat(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_.]/.test(input[j])) j++;
      const id = input.slice(i, j);
      if (id === "true" || id === "false") {
        tokens.push({ type: "bool", value: id === "true" });
      } else if (id === "null") {
        tokens.push({ type: "null" });
      } else {
        tokens.push({ type: "ident", value: id });
      }
      i = j;
      continue;
    }
    throw new Error(`unexpected char: ${c}`);
  }
  return tokens;
}

type Node =
  | { kind: "literal"; value: unknown }
  | { kind: "ref"; path: string }
  | { kind: "not"; expr: Node }
  | { kind: "binop"; op: "=="|"!="|"&&"|"||"; left: Node; right: Node };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  isAtEnd() { return this.pos >= this.tokens.length; }
  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private eat(): Token { return this.tokens[this.pos++]; }

  parseExpression(): Node { return this.parseOr(); }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.matchOp("||")) {
      const right = this.parseAnd();
      left = { kind: "binop", op: "||", left, right };
    }
    return left;
  }
  private parseAnd(): Node {
    let left = this.parseEq();
    while (this.matchOp("&&")) {
      const right = this.parseEq();
      left = { kind: "binop", op: "&&", left, right };
    }
    return left;
  }
  private parseEq(): Node {
    const left = this.parseUnary();
    if (this.matchOp("==")) {
      return { kind: "binop", op: "==", left, right: this.parseUnary() };
    }
    if (this.matchOp("!=")) {
      return { kind: "binop", op: "!=", left, right: this.parseUnary() };
    }
    return left;
  }
  private parseUnary(): Node {
    if (this.matchOp("!")) return { kind: "not", expr: this.parseUnary() };
    return this.parseAtom();
  }
  private parseAtom(): Node {
    const t = this.eat();
    if (!t) throw new Error("unexpected end of expression");
    if (t.type === "op" && t.value === "(") {
      const inner = this.parseExpression();
      const close = this.eat();
      if (!close || close.type !== "op" || close.value !== ")") {
        throw new Error("expected )");
      }
      return inner;
    }
    if (t.type === "string" || t.type === "number" || t.type === "bool") {
      return { kind: "literal", value: t.value };
    }
    if (t.type === "null") return { kind: "literal", value: null };
    if (t.type === "ident") return { kind: "ref", path: t.value };
    throw new Error(`unexpected token: ${JSON.stringify(t)}`);
  }
  private matchOp(op: string): boolean {
    const t = this.peek();
    if (t?.type === "op" && t.value === op) { this.pos++; return true; }
    return false;
  }
}

function evalNode(node: Node, values: Record<string, unknown>): unknown {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "ref": {
      // Strip optional `settings.` prefix so authors can write either
      // `settings.show_button` or just `show_button`. Forbid arbitrary
      // dotted paths beyond that — we only look up sibling settings.
      const path = node.path.startsWith("settings.")
        ? node.path.slice("settings.".length)
        : node.path;
      return values[path];
    }
    case "not":
      return !evalNode(node.expr, values);
    case "binop": {
      const l = evalNode(node.left, values);
      const r = evalNode(node.right, values);
      switch (node.op) {
        case "==":
          // eslint-disable-next-line eqeqeq
          return l == r;
        case "!=":
          // eslint-disable-next-line eqeqeq
          return l != r;
        case "&&":
          return Boolean(l) && Boolean(r);
        case "||":
          return Boolean(l) || Boolean(r);
      }
    }
  }
}
