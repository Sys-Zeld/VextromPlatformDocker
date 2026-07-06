import { Pagination } from "react-bootstrap";

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Paginação compacta reutilizável das listas do SentinelGrid.
// Mostra "X–Y de Z" + controles. Some quando cabe tudo numa página.
export default function Pager({ page, pageSize, total, onPageChange }: PagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // Janela de no máximo 5 números centrada na página atual.
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(pageCount, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const numbers: number[] = [];
  for (let p = start; p <= end; p += 1) numbers.push(p);

  return (
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 border-top">
      <span className="small text-muted">
        {from}–{to} de {total}
      </span>
      <Pagination size="sm" className="mb-0">
        <Pagination.First disabled={current === 1} onClick={() => onPageChange(1)} />
        <Pagination.Prev disabled={current === 1} onClick={() => onPageChange(current - 1)} />
        {start > 1 && <Pagination.Ellipsis disabled />}
        {numbers.map((p) => (
          <Pagination.Item key={p} active={p === current} onClick={() => onPageChange(p)}>
            {p}
          </Pagination.Item>
        ))}
        {end < pageCount && <Pagination.Ellipsis disabled />}
        <Pagination.Next disabled={current === pageCount} onClick={() => onPageChange(current + 1)} />
        <Pagination.Last disabled={current === pageCount} onClick={() => onPageChange(pageCount)} />
      </Pagination>
    </div>
  );
}
