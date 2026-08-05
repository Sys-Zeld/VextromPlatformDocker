import type { QuillDelta } from "../components/RichTextEditor";

// Muitos capítulos foram salvos antes do editor do SPA passar a enviar Delta
// junto com o HTML (ver ReportSectionCard). Nesses casos o backend gerou um
// Delta "degradado" via buildDeltaFromText(extractTextFromHtml(html)) — um
// único bloco de texto puro, sem formatação, sem imagens e com todas as
// quebras de parágrafo colapsadas em espaço. Se o RichTextEditor carregar
// esse Delta como valor controlado, a formatação/imagens do content_html
// somem da edição mesmo existindo no HTML salvo.
//
// Esta checagem decide se o Delta salvo é confiável o suficiente para ser
// usado como valor inicial do editor (estrutura real: múltiplos blocos,
// atributos de formatação ou embeds) ou se é melhor cair para o HTML (que é
// sempre a fonte correta, mas reconvertido via clipboard.convert() do Quill —
// aceitável para conteúdo antigo, apenas não é o caminho preferido para
// conteúdo novo).

function htmlLooksRich(html: string | null | undefined): boolean {
  const s = String(html || "");
  const pCount = (s.match(/<p[\s>]/gi) || []).length;
  if (pCount > 1) return true;
  if (/<br\s*\/?>/i.test(s)) return true;
  if (/<(strong|em|u|img|h1|h2|h3|ul|ol|blockquote|a)\b/i.test(s)) return true;
  if (/ql-align-|ql-indent-|style="/i.test(s)) return true;
  return false;
}

function deltaLooksStructured(delta: QuillDelta | null | undefined): boolean {
  if (!delta || !Array.isArray(delta.ops) || !delta.ops.length) return false;
  if (delta.ops.length > 1) return true;
  const onlyOp = delta.ops[0] as { insert?: unknown; attributes?: Record<string, unknown> };
  if (!onlyOp) return false;
  if (onlyOp.insert && typeof onlyOp.insert === "object") return true;
  if (onlyOp.attributes && Object.keys(onlyOp.attributes).length > 0) return true;
  const text = typeof onlyOp.insert === "string" ? onlyOp.insert : "";
  // Mais de uma quebra de linha (além da final) indica múltiplos parágrafos
  // preservados — Delta gerado por buildDeltaFromText tem exatamente uma.
  return (text.match(/\n/g) || []).length > 1;
}

// Retorna o Delta apenas se for seguro usá-lo como valor inicial do editor;
// caso contrário null, para o chamador cair de volta para o HTML.
export function trustedInitialDelta(delta: QuillDelta | null | undefined, html: string | null | undefined): QuillDelta | null {
  if (!delta) return null;
  if (!htmlLooksRich(html)) return delta;
  return deltaLooksStructured(delta) ? delta : null;
}
