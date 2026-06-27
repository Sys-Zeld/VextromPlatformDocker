import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "link"],
    ["clean"]
  ]
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

// Editor rich-text (Quill) compartilhado. Produz/consome HTML, compatível com
// o conteúdo de relatório do legado.
export default function RichTextEditor({ value, onChange, readOnly, placeholder }: Props) {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      modules={MODULES}
    />
  );
}
