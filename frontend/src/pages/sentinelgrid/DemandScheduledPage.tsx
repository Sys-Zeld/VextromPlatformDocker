import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import SgIcon from "../../components/sentinelgrid/SgIcon";
import { formatDate } from "../../utils/format";
import { listClients } from "../../api/sentinelgrid/clients";
import { listTechnicians } from "../../api/sentinelgrid/technicians";
import {
  SgDemandGenerateResult,
  SgDemandGroup,
  SgDemandStatus,
  generateDemands,
  listScheduledDemands,
  setDemandGroupDuration,
  setDemandGroupTechnicians
} from "../../api/sentinelgrid/demands";

const STATUS_VARIANT: Record<SgDemandStatus, string> = {
  pendente: "warning",
  parcial: "info",
  gerada: "success"
};

const STATUS_LABEL: Record<SgDemandStatus, string> = {
  pendente: "pendente",
  parcial: "parcial",
  gerada: "gerada"
};

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// OM que já virou OS não entra numa nova geração — só as pendentes são selecionáveis.
function pendingOrderIds(group: SgDemandGroup): number[] {
  return group.orders.filter((order) => !order.rsServiceOrderId).map((order) => order.orderId);
}

export default function DemandScheduledPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(isoDate(0));
  const [to, setTo] = useState(isoDate(30));
  const [clientId, setClientId] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<SgDemandGenerateResult[]>([]);

  // Erro de edição (equipe ou duração) exibido no card do próprio grupo.
  const [groupError, setGroupError] = useState<Record<string, string>>({});

  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients() });
  const technicians = useQuery({ queryKey: ["sentinelgrid", "technicians"], queryFn: listTechnicians });
  const demands = useQuery({
    queryKey: ["sentinelgrid", "demands", { from, to, clientId, search }],
    queryFn: () => listScheduledDemands({ from, to, clientId: clientId || undefined, search: search || undefined }),
    placeholderData: keepPreviousData
  });

  const groups = useMemo(() => demands.data?.groups || [], [demands.data]);

  // Toda OM pendente entra selecionada; o usuário desmarca o que não quer no lote.
  useEffect(() => {
    setSelected(Object.fromEntries(groups.flatMap((group) => pendingOrderIds(group).map((id) => [id, true]))));
  }, [groups]);

  const selectedIdsOf = (group: SgDemandGroup) => pendingOrderIds(group).filter((id) => selected[id]);

  // Sem técnico não há OS: a equipe é obrigatória (o backend também recusa — SG_DEMAND_NO_TECHNICIAN).
  const hasTeam = (group: SgDemandGroup) => group.technicians.length > 0;

  const generate = useMutation({
    mutationFn: (payload: Array<{ groupKey: string; orderIds: number[] }>) => generateDemands(payload),
    onSuccess: (data) => {
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: ["sentinelgrid", "demands"] });
      queryClient.invalidateQueries({ queryKey: ["sentinelgrid", "maintenance-orders"] });
    }
  });

  // A equipe é do grupo (a futura OS) e vale para todas as OMs dele — inclusive as já enviadas,
  // cuja OS é sincronizada pelo backend.
  const team = useMutation({
    mutationFn: (input: { groupKey: string; orderIds: number[]; technicianIds: number[] }) =>
      setDemandGroupTechnicians({ orderIds: input.orderIds, technicianIds: input.technicianIds }),
    onSuccess: (_data, input) => {
      setGroupError((state) => ({ ...state, [input.groupKey]: "" }));
      queryClient.invalidateQueries({ queryKey: ["sentinelgrid", "demands"] });
    },
    onError: (error: Error, input) => {
      setGroupError((state) => ({ ...state, [input.groupKey]: error.message || "Falha ao alterar a equipe." }));
    }
  });

  const setGroupTeam = (group: SgDemandGroup, technicianIds: number[]) =>
    team.mutate({
      groupKey: group.groupKey,
      orderIds: group.orders.map((order) => order.orderId),
      technicianIds
    });

  // Duração é da OS: vale para todas as OMs do grupo. Esticar a mobilização pode invadir outra
  // frente do técnico, e o backend recusa.
  const duration = useMutation({
    mutationFn: (input: { groupKey: string; orderIds: number[]; executionDays: number }) =>
      setDemandGroupDuration({ orderIds: input.orderIds, executionDays: input.executionDays }),
    onSuccess: (_data, input) => {
      setGroupError((state) => ({ ...state, [input.groupKey]: "" }));
      queryClient.invalidateQueries({ queryKey: ["sentinelgrid", "demands"] });
    },
    onError: (error: Error, input) => {
      setGroupError((state) => ({ ...state, [input.groupKey]: error.message || "Falha ao alterar a duração." }));
    }
  });

  // Enquanto todas as OMs do grupo não tiverem sido igualadas (OMs antigas podem ter durações
  // diferentes), o campo mostra a maior — que é a que define o fim da mobilização.
  const groupDuration = (group: SgDemandGroup) =>
    Math.max(...group.orders.map((order) => order.executionDays));

  const setGroupDays = (group: SgDemandGroup, executionDays: number) =>
    duration.mutate({
      groupKey: group.groupKey,
      orderIds: group.orders.map((order) => order.orderId),
      executionDays
    });

  const generateGroup = (group: SgDemandGroup) => {
    const orderIds = selectedIdsOf(group);
    if (!orderIds.length || !hasTeam(group)) return;
    generate.mutate([{ groupKey: group.groupKey, orderIds }]);
  };

  const generateAll = () => {
    const payload = groups
      .filter(hasTeam)
      .map((group) => ({ groupKey: group.groupKey, orderIds: selectedIdsOf(group) }))
      .filter((group) => group.orderIds.length > 0);
    if (payload.length) generate.mutate(payload);
  };

  // Grupos sem equipe não entram no lote — o total reflete só o que é gerável.
  const pendingTotal = groups.reduce(
    (total, group) => total + (hasTeam(group) ? selectedIdsOf(group).length : 0),
    0
  );
  const resultOf = (groupKey: string) => results.find((result) => result.groupKey === groupKey);

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Body className="d-flex flex-wrap align-items-end gap-3">
          <Form.Group>
            <Form.Label className="small mb-1">De</Form.Label>
            <Form.Control type="date" size="sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Até</Form.Label>
            <Form.Control type="date" size="sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Cliente</Form.Label>
            <Form.Select size="sm" value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
              <option value={0}>Todos</option>
              {(clients.data?.clients || []).map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="flex-grow-1" style={{ minWidth: 220 }}>
            <Form.Label className="small mb-1">Busca</Form.Label>
            <Form.Control
              size="sm"
              placeholder="OM, TAG ou escopo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Form.Group>
          <Button
            variant="primary"
            size="sm"
            onClick={generateAll}
            disabled={!pendingTotal || generate.isPending}
          >
            {generate.isPending ? <Spinner size="sm" animation="border" className="me-2" /> : <SgIcon name="export" size={18} className="me-2" />}
            Gerar todas as OSs ({pendingTotal} OMs)
          </Button>
        </Card.Body>
      </Card>

      {generate.isError && (
        <Alert variant="danger">{(generate.error as Error).message || "Falha ao gerar as OSs."}</Alert>
      )}
      {generate.isSuccess && (
        <Alert variant={generate.data.failed ? "warning" : "success"} dismissible onClose={() => setResults([])}>
          {generate.data.generated} OS gerada(s){generate.data.failed ? `, ${generate.data.failed} grupo(s) com falha.` : "."}
        </Alert>
      )}

      {demands.isLoading && <Spinner animation="border" />}
      {demands.error && <Alert variant="danger">Falha ao carregar a demanda agendada.</Alert>}
      {!demands.isLoading && !groups.length && (
        <Alert variant="secondary">
          Nenhuma OM agendada no período. Só entram aqui OMs com status <strong>agendada</strong> e data definida.
        </Alert>
      )}

      {groups.map((group) => {
        const result = resultOf(group.groupKey);
        const selectable = pendingOrderIds(group);
        const chosen = selectedIdsOf(group);
        return (
          <Card key={group.groupKey}>
            <Card.Header className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <strong>{group.clientName} · {group.siteName}</strong>
                <span className="text-muted ms-2">
                  {formatDate(group.date)}
                  {group.endDate !== group.date && ` → ${formatDate(group.endDate)}`}
                </span>
                <Badge bg={STATUS_VARIANT[group.status]} className="ms-2">{STATUS_LABEL[group.status]}</Badge>
              </div>
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div className="d-flex align-items-center gap-1">
                  <span className="small text-muted">Duração:</span>
                  <Form.Control
                    type="number"
                    size="sm"
                    min={1}
                    max={365}
                    style={{ width: 70 }}
                    key={`${group.groupKey}:${groupDuration(group)}`}
                    defaultValue={groupDuration(group)}
                    disabled={duration.isPending}
                    onBlur={(e) => {
                      const days = Number((e.target as HTMLInputElement).value);
                      if (days !== groupDuration(group) && days >= 1 && days <= 365) setGroupDays(group, days);
                    }}
                  />
                  <span className="small text-muted">{groupDuration(group) === 1 ? "dia" : "dias"}</span>
                </div>
                <div className="d-flex align-items-center gap-1 flex-wrap">
                  <span className="small text-muted me-1">Equipe:</span>
                  {group.technicians.map((technician) => (
                    <Badge bg="light" text="dark" key={technician.id} className="d-inline-flex align-items-center gap-1 border">
                      {technician.name}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: "0.5rem" }}
                        aria-label={`Remover ${technician.name}`}
                        disabled={team.isPending}
                        onClick={() => setGroupTeam(
                          group,
                          group.technicians.filter((current) => current.id !== technician.id).map((current) => current.id)
                        )}
                      />
                    </Badge>
                  ))}
                  <Form.Select
                    size="sm"
                    style={{ width: 165 }}
                    value=""
                    disabled={team.isPending}
                    onChange={(e) => {
                      const technicianId = Number(e.target.value);
                      if (technicianId) setGroupTeam(group, [...group.technicians.map((t) => t.id), technicianId]);
                    }}
                  >
                    <option value="">+ Adicionar técnico</option>
                    {(technicians.data?.technicians || [])
                      .filter((technician) => !group.technicians.some((current) => current.id === technician.id))
                      .map((technician) => (
                        <option key={technician.id} value={technician.id}>{technician.name}</option>
                      ))}
                  </Form.Select>
                </div>
                {group.rsServiceOrderId && (
                  <a
                    className="small"
                    href={`/app/orders/${group.rsServiceOrderId}/editor`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OS {group.rsServiceOrderCode || `#${group.rsServiceOrderId}`}
                  </a>
                )}
                {selectable.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={!chosen.length || !hasTeam(group) || generate.isPending}
                    title={!hasTeam(group) ? "Adicione ao menos um técnico à equipe para gerar a OS." : undefined}
                    onClick={() => generateGroup(group)}
                  >
                    Gerar OS ({chosen.length} {chosen.length === 1 ? "OM" : "OMs"})
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>OM</th>
                    <th>Equipamento</th>
                    <th>Manutenção</th>
                    <th>Duração</th>
                    <th>Técnicos</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {group.orders.map((order) => (
                    <tr key={order.orderId} className={order.rsServiceOrderId ? "text-muted" : ""}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          disabled={Boolean(order.rsServiceOrderId)}
                          checked={Boolean(selected[order.orderId]) && !order.rsServiceOrderId}
                          onChange={(e) => setSelected((state) => ({ ...state, [order.orderId]: e.target.checked }))}
                        />
                      </td>
                      <td>{order.orderNumber}</td>
                      <td>{order.equipmentTag}</td>
                      <td>{String(order.maintenanceType).replace(/_/g, " ")}</td>
                      <td>{order.executionDays} {order.executionDays === 1 ? "dia" : "dias"}</td>
                      <td>{order.technicians.map((technician) => technician.name).join(", ") || "-"}</td>
                      <td>
                        {order.rsServiceOrderId ? (
                          <a href={`/app/orders/${order.rsServiceOrderId}/editor`} target="_blank" rel="noreferrer">
                            já em OS {order.rsServiceOrderCode || `#${order.rsServiceOrderId}`}
                          </a>
                        ) : (
                          <span className="text-warning">aguardando OS</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {selectable.length > 0 && !hasTeam(group) && (
                <Alert variant="warning" className="m-3 mb-0 py-2 small">
                  Adicione ao menos um técnico à equipe para gerar a OS deste grupo.
                </Alert>
              )}
              {groupError[group.groupKey] && (
                <Alert variant="danger" className="m-3 mb-0 py-2 small">{groupError[group.groupKey]}</Alert>
              )}
              {result && !result.ok && (
                <Alert variant="danger" className="m-3 mb-0 py-2 small">{result.error}</Alert>
              )}
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}
