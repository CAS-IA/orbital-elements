/* Origen: faro-orbital-widget/client/src/services/partial-json.ts (en producción). */
/**
 * Parser JSON tolerante para resultados estructurados que llegan por stream.
 *
 * - Quita el envoltorio ```json … ``` que algunos modelos añaden.
 * - Si el JSON está incompleto, lo cierra (comillas, arrays, objetos) y
 *   descarta la última clave a medias, devolviendo lo ya recibido.
 * Devuelve null si aún no hay un objeto/array reconocible.
 */

/** Quita fences de markdown y espacios alrededor del JSON. */
export function stripJsonFences(text: string): string {
  let s = text.trim();
  const fence = s.match(/^```[a-zA-Z]*\s*\n?/);
  if (fence) s = s.slice(fence[0].length);
  s = s.replace(/\n?```\s*$/, '');
  return s.trim();
}

/** Parseo completo con fences tolerados; null si no es JSON válido. */
export function parseJsonLoose(text: string): unknown | null {
  try {
    return JSON.parse(stripJsonFences(text));
  } catch {
    return null;
  }
}

/**
 * Intenta parsear JSON incompleto. Recorre el texto llevando la pila de
 * contenedores abiertos; al final cierra lo pendiente. Si el resultado sigue
 * siendo inválido, recorta hasta la última coma de nivel y reintenta.
 */
export function parsePartialJson(text: string): unknown | null {
  const s = stripJsonFences(text);
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const body = s.slice(start);

  const full = tryParse(body);
  if (full !== undefined) return full;

  // Candidatos de corte: posiciones tras cada coma/apertura de nivel (fuera de strings)
  const cuts: number[] = [];
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') { stack.push(c); cuts.push(i + 1); }
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',') cuts.push(i);
  }

  // 1º: cerrar tal cual (el último valor quizá esté completo)
  const closedWhole = closeAndParse(body);
  if (closedWhole !== undefined) return closedWhole;

  // 2º: recortar desde el último punto de corte hacia atrás
  for (let k = cuts.length - 1; k >= 0; k--) {
    const attempt = closeAndParse(body.slice(0, cuts[k]));
    if (attempt !== undefined) return attempt;
  }
  return null;
}

function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Cierra strings y contenedores abiertos y parsea. */
function closeAndParse(fragment: string): unknown | undefined {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const c of fragment) {
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  let s = fragment;
  if (inString) {
    if (escaped) s = s.slice(0, -1);
    s += '"';
  }
  // Clave sin valor al final de un objeto (`{ "a": 1, "cla` o `{ "a": 1, "clave":`) → se descarta
  s = s.replace(/\s*:\s*$/, '');
  if (stack[stack.length - 1] === '}') {
    s = s.replace(/([{,])\s*"(?:[^"\\]|\\.)*"\s*$/, '$1');
  }
  s = s.replace(/[,\s]+$/, '');
  return tryParse(s + stack.reverse().join(''));
}

/**
 * Acumulador para streaming: se le van pasando trozos de texto (tokens del
 * modelo o `tool.delta`) y devuelve la mejor spec parcial hasta ahora.
 * Pásala a `validateSpec(spec, { partial: true })` o directamente a
 * `<OrbitalRenderer partial />`: los nodos completos se pintan en cuanto
 * llegan y los incompletos esperan, sin errores.
 */
export function createSpecAccumulator() {
  let text = '';
  let last: unknown = null;
  return {
    push(chunk: string): unknown {
      text += chunk;
      const parsed = parsePartialJson(text);
      if (parsed !== null) last = parsed;
      return last;
    },
    get value(): unknown {
      return last;
    },
    get text(): string {
      return text;
    },
    reset() {
      text = '';
      last = null;
    },
  };
}
