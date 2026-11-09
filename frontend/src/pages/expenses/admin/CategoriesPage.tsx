import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { CategoryInput, ExpenseCategory, createCategory, listAllCategories, updateCategory } from "../../../api/expenses";
import IconAction from "../../../components/IconAction";
import { PageHeader, errorMessage } from "../shared";

const EMPTY: CategoryInput = { name: "", description: "", active: true, sortOrder: 100 };

// Categorias não são excluídas (lançamentos as referenciam): desative.
export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "categories-admin"], queryFn: listAllCategories });
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CategoryInput>(EMPTY);

  const m = useMutation({
    mutationFn: () => (editing ? updateCategory(editing.id, form) : createCategory(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "categories-admin"] });
      qc.invalidateQueries({ queryKey: ["expenses", "meta"] });
      setOpen(false);
    }
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); m.reset(); setOpen(true); };
  const openEdit = (c: ExpenseCategory) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description, active: c.active, sortOrder: c.sort_order });
    m.reset();
    setOpen(true);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader title="Categorias de despesa" actions={<Button size="sm" onClick={openNew}>Nova categoria</Button>} />
      <Card>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /></Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Ordem</th><th>Nome</th><th>Descrição</th><th>Situação</th><th className="text-end">Ações</th></tr></thead>
            <tbody>
              {(data?.categories ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.sort_order}</td>
                  <td>{c.name}</td>
                  <td className="small text-muted">{c.description || "-"}</td>
                  <td>{c.active ? <Badge bg="success">Ativa</Badge> : <Badge bg="secondary">Inativa</Badge>}</td>
                  <td><div className="d-flex vx-actions"><IconAction icon="edit" label="Editar categoria" onClick={() => openEdit(c)} /></div></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={open} onHide={() => setOpen(false)}>
        <Form onSubmit={(e: FormEvent) => { e.preventDefault(); if (form.name.trim()) m.mutate(); }}>
          <Modal.Header closeButton><Modal.Title as="h6">{editing ? "Editar categoria" : "Nova categoria"}</Modal.Title></Modal.Header>
          <Modal.Body className="d-flex flex-column gap-3">
            {m.error && <Alert variant="danger" className="mb-0">{errorMessage(m.error)}</Alert>}
            <Form.Group>
              <Form.Label>Nome *</Form.Label>
              <Form.Control required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Descrição</Form.Label>
              <Form.Control maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Ordem de exibição</Form.Label>
              <Form.Control type="number" min={0} max={10000} value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
            </Form.Group>
            <Form.Check type="switch" id="cat-active" label="Ativa (disponível para novos lançamentos)" checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!form.name.trim() || m.isPending}>Salvar</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
