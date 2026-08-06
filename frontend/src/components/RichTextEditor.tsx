import { useMemo, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Delta do Quill: representação estruturada e sem perdas do conteúdo (é o que
// o editor legado sempre salva/recarrega). Usar Delta como valor controlado
// evita o round-trip HTML -> Delta -> HTML que o Quill 2 não garante ser
// perfeito (ver comentário abaixo sobre useSemanticHTML).
export interface QuillDelta { ops: Array<Record<string, unknown>> }

const BASE_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ align: [] }],
  ["blockquote", "link"],
  ["clean"]
];

interface Props {
  value: string | QuillDelta;
  onChange: (html: string, delta: QuillDelta) => void;
  readOnly?: boolean;
  placeholder?: string;
  // Classe aplicada ao wrapper do editor, para escopar overrides de CSS
  // (ex.: "report-quill-editor" — ver theme.css) sem afetar outros usos
  // deste componente (ex.: o editor de diário em OrderEditorPage).
  className?: string;
  // Quando informado, adiciona o botão "Imagem" na toolbar: abre um seletor
  // de arquivo, chama esta função com o arquivo escolhido (que deve fazer o
  // upload e devolver a URL final) e insere o resultado como <img> no
  // conteúdo. Sem isto o Quill não oferece forma de inserir imagem embutida
  // — colar uma imagem (Ctrl+V) gera uma URL blob:/file:, que o sanitizador
  // do backend remove (só http/https/data são aceitos para <img src>),
  // ficando com um <img> sem src — quebrado em qualquer contexto, inclusive
  // no PDF gerado via Puppeteer.
  onImageUpload?: (file: File) => Promise<string>;
}

// Editor rich-text (Quill) compartilhado, compatível com o conteúdo de
// relatório do legado (Quill 1.3.7).
//
// useSemanticHTML={false}: o exportador "semantic HTML" do Quill 2
// (getSemanticHTML/convertHTML) substitui incondicionalmente todo espaço
// normal por "&nbsp;" em texto, o que quebra a quebra de linha no
// preview/PDF. Desligado, o editor usa root.innerHTML (DOM real), igual ao
// que o editor legado sempre fez.
//
// value/onChange aceitam Delta além de HTML: passar um valor HTML string faz
// o Quill 2 reconverter via clipboard.convert() a cada re-sync do prop
// `value`, e essa conversão não garante preservar blocos de parágrafo vazios
// (<p><br></p>) usados para espaçamento vertical. Passando o Delta salvo
// diretamente (como o editor legado faz) evita essa conversão com perdas.
export default function RichTextEditor({ value, onChange, readOnly, placeholder, className, onImageUpload }: Props) {
  const quillRef = useRef<ReactQuill>(null);

  // Mesma abordagem do editor legado (report-section-editor.js): o botão
  // "image" da toolbar abre um <input type="file">, faz upload e insere via
  // insertEmbed — nunca deixa o Quill inserir a imagem "crua" do clipboard.
  const modules = useMemo(() => {
    if (!onImageUpload) return { toolbar: BASE_TOOLBAR };
    const lastGroup = BASE_TOOLBAR[BASE_TOOLBAR.length - 1];
    const middleGroups = BASE_TOOLBAR.slice(0, -1);
    return {
      toolbar: {
        container: [...middleGroups, ["image"], lastGroup],
        handlers: {
          image() {
            const input = document.createElement("input");
            input.setAttribute("type", "file");
            input.setAttribute("accept", "image/*");
            input.style.display = "none";
            document.body.appendChild(input);
            input.onchange = () => {
              const file = input.files && input.files[0];
              document.body.removeChild(input);
              if (!file) return;
              onImageUpload(file)
                .then((src) => {
                  if (!src) return;
                  const editor = quillRef.current?.getEditor();
                  if (!editor) return;
                  const range = editor.getSelection(true);
                  const index = range ? range.index : editor.getLength();
                  editor.insertEmbed(index, "image", src, "user");
                  editor.setSelection(index + 1, 0, "user");
                })
                .catch(() => {});
            };
            input.click();
          }
        }
      }
    };
  }, [onImageUpload]);

  return (
    <ReactQuill
      ref={quillRef}
      theme="snow"
      className={className}
      // react-quill-new tipa `value` como string | DeltaStatic (a classe real de
      // "quill-delta"), mas o Quill so verifica `value.ops` em runtime (duck
      // typing) — um objeto plano { ops: [...] } funciona igual. Sem esse cast
      // precisariamos importar "quill-delta" so para satisfazer o tipo.
      value={value as unknown as string}
      useSemanticHTML={false}
      onChange={(html, _delta, _source, editor) => onChange(html, editor.getContents() as unknown as QuillDelta)}
      readOnly={readOnly}
      placeholder={placeholder}
      modules={modules}
    />
  );
}
