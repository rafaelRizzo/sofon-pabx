import { prisma } from "../../lib/prisma";
import { FlowRepository } from "../../asterisk/flow.repository";
import { FlowNodeRepository } from "../../asterisk/flow-node.repository";
import { FlowEdgeRepository } from "../../asterisk/flow-edge.repository";
import { AsteriskQueueRepository } from "../../asterisk/queue.repository";
import { AnnouncementRepository } from "../../asterisk/announcement.repository";
import { TimeConditionRepository } from "../../asterisk/timecondition.repository";
import { HolidayGroupRepository } from "../../asterisk/holidaygroup.repository";
import { IvrRepository } from "../../asterisk/ivr.repository";
import { VariableRepository } from "../../asterisk/variable.repository";
import { VariableConditionRepository } from "../../asterisk/variablecondition.repository";
import { FlowsCache } from "./cache/flows.cache";
import { AppError } from "../../utils/errors/app.error";
import { logger } from "../../utils/logger";

export const FLOW_NODE_TYPES = [
  "extension",
  "queue",
  "voicemail",
  "timecondition",
  "holiday",
  "announcement",
  "ivr",
  "request",
  "ixc",
  "variable-set",
  "variable-condition",
  "flow",
  "hangup",
] as const;

export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];
type Position = { x: number; y: number };

const DELETABLE_RESOURCE_TYPES = new Set<FlowNodeType>([
  "queue",
  "announcement",
  "timecondition",
  "holiday",
  "request",
  "ixc",
  "variable-set",
  "variable-condition",
]);

const portsByType: Record<FlowNodeType, readonly string[]> = {
  extension: [],
  queue: ["default"],
  voicemail: [],
  timecondition: ["true", "false"],
  holiday: ["true", "false"],
  announcement: ["default"],
  // `long` só existe em URA de coleta. As saídas de dígitos são verificadas
  // contra as opções configuradas no próprio recurso em assertPort().
  ivr: ["invalid", "timeout"],
  request: ["success", "error"],
  ixc: ["success", "error"],
  "variable-set": ["default"],
  "variable-condition": ["true", "false"],
  flow: [],
  hangup: [],
};

async function getFlowOrThrow(flowId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { id: true, companyId: true, entryNodeId: true },
  });
  if (!flow) throw new AppError("Flow not found", 404);
  return flow;
}

async function assertResource(
  type: FlowNodeType,
  resourceId: string | null | undefined,
  companyId: string,
  flowId: string,
) {
  if (type === "hangup") {
    if (resourceId)
      throw new AppError("Hangup node cannot have a resource", 400);
    return;
  }
  if (!resourceId)
    throw new AppError(`Node type ${type} requires resourceId`, 400);
  if (type === "voicemail") return;

  const companySelect = { companyId: true } as const;
  let found: { companyId: string } | null = null;
  switch (type) {
    case "extension":
      found = await prisma.extension.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "queue":
      found = await prisma.queue.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "timecondition":
      found = await prisma.timeCondition.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "holiday":
      found = await prisma.holidayGroup.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "announcement":
      found = await prisma.announcement.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "ivr":
      found = await prisma.ivrMenu.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "request":
      found = await prisma.requestTemplate.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "ixc":
      found = await prisma.ixcNode.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "variable-set":
      found = await prisma.variableSet.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "variable-condition":
      found = await prisma.variableCondition.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      break;
    case "flow": {
      found = await prisma.flow.findUnique({
        where: { id: resourceId },
        select: companySelect,
      });
      if (resourceId === flowId)
        throw new AppError("A Flow node cannot reference its own Flow", 400);
      break;
    }
    default:
      break;
  }
  if (!found) throw new AppError(`${type} resource not found`, 404);
  if (found.companyId !== companyId)
    throw new AppError(`${type} resource belongs to different company`, 403);
}

async function assertPort(
  type: FlowNodeType,
  resourceId: string | null,
  port: string,
) {
  if (type === "ivr") {
    if (port.startsWith("digit:")) {
      const digit = port.slice("digit:".length);
      const option = resourceId
        ? await prisma.ivrOption.findFirst({
            where: { ivrMenuId: resourceId, digit },
            select: { id: true },
          })
        : null;
      if (option) return;
    }
    if (port === "long") {
      const menu = resourceId
        ? await prisma.ivrMenu.findUnique({
            where: { id: resourceId },
            select: { type: true },
          })
        : null;
      if (menu?.type === "collect") return;
    }
  }
  if (!portsByType[type].includes(port))
    throw new AppError(`Port ${port} is not valid for node type ${type}`, 400);
}

async function assertFlowReferenceNoCycle(
  flowId: string,
  targetFlowId: string,
) {
  const pending = [targetFlowId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (current === flowId)
      throw new AppError("Flows cannot reference each other cyclically", 409);
    if (visited.has(current)) continue;
    visited.add(current);
    const children = await prisma.flowNode.findMany({
      where: { flowId: current, type: "flow", resourceId: { not: null } },
      select: { resourceId: true },
    });
    for (const child of children)
      if (child.resourceId) pending.push(child.resourceId);
  }
}

async function assertNoCycle(
  flowId: string,
  sourceNodeId: string,
  targetNodeId: string,
) {
  if (sourceNodeId === targetNodeId)
    throw new AppError("A node cannot connect to itself", 400);
  const edges = await prisma.flowNodeEdge.findMany({
    where: { flowId },
    select: { sourceNodeId: true, targetNodeId: true },
  });
  const queue = [targetNodeId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceNodeId)
      throw new AppError("Cycles are not allowed in a call flow", 409);
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges)
      if (edge.sourceNodeId === current) queue.push(edge.targetNodeId);
  }
}

function assertNoCycleInEdges(
  sourceNodeId: string,
  targetNodeId: string,
  edges: { sourceNodeId: string; targetNodeId: string }[],
) {
  if (sourceNodeId === targetNodeId)
    throw new AppError("A node cannot connect to itself", 400);

  const queue = [targetNodeId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceNodeId)
      throw new AppError("Cycles are not allowed in a call flow", 409);
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges)
      if (edge.sourceNodeId === current) queue.push(edge.targetNodeId);
  }
}

const flowEdgeLocks = new Map<string, Promise<unknown>>();

// Mesmo padrão de withDialplanLock (dialplan-file.repository.ts): serializa leitura+validação de
// ciclo+escrita das arestas de um mesmo flow. Sem isso, duas requisições concorrentes de conexão
// (2 abas, duplo clique) que fechem um ciclo juntas passariam cada uma no próprio assertNoCycle
// antes de qualquer commit, já que a leitura e a escrita não estavam na mesma seção crítica.
function withFlowEdgeLock<T>(flowId: string, fn: () => Promise<T>): Promise<T> {
  const previous = flowEdgeLocks.get(flowId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  flowEdgeLocks.set(
    flowId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

// Best-effort, mesmo motivo do regenerateSafely em queues.service.ts: o FlowNode/FlowNodeEdge já
// foi commitado, e cada um desses recursos embute um GotoIf($[FLOW_NODE_ID]...) (ver
// nodeExitCheck em flow-node-runtime.ts) que só existe no .conf dele depois de um regenerate seu —
// sem chamar aqui, editar o node/edge no canvas nunca atualiza o dialplan do recurso reutilizado
// (ele só se atualizaria da próxima vez que fosse salvo pelo próprio CRUD, fora do Flow).
const regenerateSafely = async (fn: () => Promise<void>, companyId: string) => {
  try {
    await fn();
  } catch (error) {
    logger.error({
      event: "flow.dialplan.regenerate.failed",
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

async function regenerate(flowId: string, companyId: string) {
  await FlowNodeRepository.regenerate(companyId);
  await FlowRepository.regenerate(companyId);
  await Promise.all([
    regenerateSafely(
      () => AsteriskQueueRepository.regenerate(companyId),
      companyId,
    ),
    regenerateSafely(
      () => AnnouncementRepository.regenerate(companyId),
      companyId,
    ),
    regenerateSafely(
      () => TimeConditionRepository.regenerate(companyId),
      companyId,
    ),
    regenerateSafely(
      () => HolidayGroupRepository.regenerate(companyId),
      companyId,
    ),
    regenerateSafely(() => IvrRepository.regenerate(companyId), companyId),
    regenerateSafely(() => VariableRepository.regenerate(companyId), companyId),
    regenerateSafely(
      () => VariableConditionRepository.regenerate(companyId),
      companyId,
    ),
  ]);
  await FlowsCache.invalidateFlow(flowId);
  await FlowsCache.invalidateByCompany(companyId);
}

// Chamado pelo update() de cada módulo de recurso (ivr/queue/announcement/...) quando o nome
// muda. FlowNode.label é uma cópia congelada capturada na conexão (ver createFlowNode) — sem
// isso, o rótulo exibido nos conectores de outros nós do canvas (Conectar/Timeout/Inválido/
// dígitos) nunca acompanha um rename feito fora do próprio nó.
export const syncFlowNodeLabel = async (
  type: FlowNodeType,
  resourceId: string,
  label: string,
) => {
  await prisma.flowNode.updateMany({
    where: { type, resourceId },
    data: { label },
  });
};

export const getFlowNodes = async (flowId: string) => {
  const flow = await getFlowOrThrow(flowId);
  const [nodes, edges] = await Promise.all([
    prisma.flowNode.findMany({
      where: { flowId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.flowNodeEdge.findMany({
      where: { flowId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { nodes, edges, entryNodeId: flow.entryNodeId };
};

export const createFlowNode = async (
  flowId: string,
  data: {
    type: FlowNodeType;
    resourceId?: string | null;
    label?: string;
    position: Position;
  },
) => {
  const flow = await getFlowOrThrow(flowId);
  await assertResource(data.type, data.resourceId, flow.companyId, flowId);
  if (data.type === "flow" && data.resourceId)
    await assertFlowReferenceNoCycle(flowId, data.resourceId);
  const node = await prisma.$transaction(async (tx) => {
    const created = await tx.flowNode.create({
      data: {
        flowId,
        type: data.type,
        resourceId: data.resourceId ?? null,
        label: data.label,
        position: data.position,
      },
    });
    return created;
  });
  // Posição/rótulo são puramente visuais; não reescrevem o dialplan a cada pixel arrastado e não
  // fazem parte do DTO cacheado em FlowsCache (ver `select` em flows.service.ts), então não há
  // o que invalidar quando só isso muda.
  if (data.resourceId !== undefined) await regenerate(flowId, flow.companyId);
  return node;
};

export const updateFlowNode = async (
  flowId: string,
  nodeId: string,
  data: {
    resourceId?: string | null;
    label?: string | null;
    position?: Position;
    isEntry?: boolean;
  },
) => {
  const [flow, node] = await Promise.all([
    getFlowOrThrow(flowId),
    prisma.flowNode.findFirst({ where: { id: nodeId, flowId } }),
  ]);
  if (!node) throw new AppError("Flow node not found", 404);
  if (data.resourceId !== undefined)
    await assertResource(
      node.type as FlowNodeType,
      data.resourceId,
      flow.companyId,
      flowId,
    );
  if (node.type === "flow" && data.resourceId)
    await assertFlowReferenceNoCycle(flowId, data.resourceId);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.flowNode.update({
      where: { id: nodeId },
      data: {
        resourceId: data.resourceId,
        label: data.label,
        position: data.position,
      },
    });
    if (data.isEntry !== undefined)
      await tx.flow.update({
        where: { id: flowId },
        data: {
          entryNodeId: data.isEntry
            ? nodeId
            : flow.entryNodeId === nodeId
              ? null
              : flow.entryNodeId,
        },
      });
    return result;
  });
  // position/label são puramente visuais (mesmo motivo do createFlowNode) — só resourceId/isEntry
  // afetam o .conf gerado e o DTO cacheado em FlowsCache. Sem esse gate, todo autosave de arraste
  // (PUT/:nodeId a cada drag-stop) dispararia um regenerate() completo da empresa (Flow + FlowNode
  // + queue/announcement/timecondition/holiday/ivr/variable/variablecondition, cada um com reload
  // de dialplan próprio) por nó movido.
  if (data.resourceId !== undefined || data.isEntry !== undefined)
    await regenerate(flowId, flow.companyId);
  return updated;
};

export const deleteFlowNode = async (flowId: string, nodeId: string) => {
  const [flow, node] = await Promise.all([
    getFlowOrThrow(flowId),
    prisma.flowNode.findFirst({ where: { id: nodeId, flowId } }),
  ]);
  if (!node) throw new AppError("Flow node not found", 404);
  await prisma.$transaction(async (tx) => {
    if (flow.entryNodeId === nodeId) {
      await tx.flow.update({
        where: { id: flowId },
        data: { entryNodeId: null },
      });
    }
    await tx.flowNode.delete({ where: { id: nodeId } });
  });
  await regenerate(flowId, flow.companyId);
};

// A exclusão do recurso é feita pelo frontend após esta checagem e após remover este nó. Assim o
// endpoint original do recurso continua sendo a única fonte da exclusão e das permissões dela.
// A checagem evita remover o nó atual e só depois descobrir que o recurso também é usado em outro
// Flow ou numa rota legada.
export const assertNodeResourceCanBeDeleted = async (
  flowId: string,
  nodeId: string,
) => {
  const flow = await getFlowOrThrow(flowId);
  const node = await prisma.flowNode.findFirst({
    where: { id: nodeId, flowId },
  });
  if (!node) throw new AppError("Flow node not found", 404);
  if (
    !node.resourceId ||
    !DELETABLE_RESOURCE_TYPES.has(node.type as FlowNodeType)
  )
    throw new AppError("This node resource cannot be deleted here", 400);

  const [otherNodes, routeReferences] = await Promise.all([
    prisma.flowNode.count({
      where: {
        type: node.type,
        resourceId: node.resourceId,
        id: { not: node.id },
      },
    }),
    FlowEdgeRepository.getReferencesTo(node.type as any, node.resourceId),
  ]);
  if (otherNodes > 0 || routeReferences.length > 0) {
    const references = [
      otherNodes > 0 ? `${otherNodes} outro(s) nó(s) de Flow` : null,
      routeReferences.length > 0 ? "outra rota do sistema" : null,
    ]
      .filter(Boolean)
      .join(" e ");
    throw new AppError(
      `Resource is still used by ${references}. Remove those references first`,
      409,
    );
  }
  return {
    type: node.type,
    resourceId: node.resourceId,
    companyId: flow.companyId,
  };
};

export const connectFlowNodes = async (
  flowId: string,
  data: { sourceNodeId: string; sourcePort: string; targetNodeId: string },
) => {
  const flow = await getFlowOrThrow(flowId);
  const edge = await withFlowEdgeLock(flowId, async () => {
    const [source, target] = await Promise.all([
      prisma.flowNode.findFirst({ where: { id: data.sourceNodeId, flowId } }),
      prisma.flowNode.findFirst({ where: { id: data.targetNodeId, flowId } }),
    ]);
    if (!source || !target)
      throw new AppError("Both nodes must belong to this Flow", 400);
    await assertPort(
      source.type as FlowNodeType,
      source.resourceId,
      data.sourcePort,
    );
    await assertNoCycle(flowId, source.id, target.id);
    return prisma.flowNodeEdge.upsert({
      where: {
        sourceNodeId_sourcePort: {
          sourceNodeId: source.id,
          sourcePort: data.sourcePort,
        },
      },
      create: {
        flowId,
        sourceNodeId: source.id,
        sourcePort: data.sourcePort,
        targetNodeId: target.id,
      },
      update: { targetNodeId: target.id },
    });
  });
  await regenerate(flowId, flow.companyId);
  return edge;
};

type FlowNodeEdgeOperation =
  | {
      type: "connect";
      sourceNodeId: string;
      sourcePort: string;
      targetNodeId: string;
    }
  | { type: "disconnect"; sourceNodeId: string; sourcePort: string };

// Aplica o estado final das saídas em uma única transação. O canvas pode agrupar alterações
// otimistas sem expor estado parcial no banco ou regenerar o dialplan a cada gesto do usuário.
export const batchFlowNodeEdges = async (
  flowId: string,
  operations: FlowNodeEdgeOperation[],
) => {
  const flow = await getFlowOrThrow(flowId);
  const edges = await withFlowEdgeLock(flowId, () =>
    applyBatchFlowNodeEdges(flowId, operations),
  );
  await regenerate(flowId, flow.companyId);
  return edges;
};

async function applyBatchFlowNodeEdges(
  flowId: string,
  operations: FlowNodeEdgeOperation[],
) {
  const [nodes, currentEdges] = await Promise.all([
    prisma.flowNode.findMany({ where: { flowId } }),
    prisma.flowNodeEdge.findMany({ where: { flowId } }),
  ]);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgesByPort = new Map(
    currentEdges.map((edge) => [
      `${edge.sourceNodeId}:${edge.sourcePort}`,
      edge,
    ]),
  );

  for (const operation of operations) {
    const source = nodesById.get(operation.sourceNodeId);
    if (!source)
      throw new AppError("Source node does not belong to this Flow", 400);
    await assertPort(
      source.type as FlowNodeType,
      source.resourceId,
      operation.sourcePort,
    );

    const key = `${operation.sourceNodeId}:${operation.sourcePort}`;
    if (operation.type === "disconnect") {
      edgesByPort.delete(key);
      continue;
    }

    if (!nodesById.has(operation.targetNodeId))
      throw new AppError("Target node does not belong to this Flow", 400);

    const simulatedEdges = [...edgesByPort.entries()]
      .filter(([edgeKey]) => edgeKey !== key)
      .map(([, edge]) => edge);
    assertNoCycleInEdges(
      operation.sourceNodeId,
      operation.targetNodeId,
      simulatedEdges,
    );
    edgesByPort.set(key, {
      sourceNodeId: operation.sourceNodeId,
      sourcePort: operation.sourcePort,
      targetNodeId: operation.targetNodeId,
    } as (typeof currentEdges)[number]);
  }

  return prisma.$transaction(async (tx) => {
    for (const operation of operations) {
      if (operation.type === "disconnect") {
        await tx.flowNodeEdge.deleteMany({
          where: {
            flowId,
            sourceNodeId: operation.sourceNodeId,
            sourcePort: operation.sourcePort,
          },
        });
        continue;
      }
      await tx.flowNodeEdge.upsert({
        where: {
          sourceNodeId_sourcePort: {
            sourceNodeId: operation.sourceNodeId,
            sourcePort: operation.sourcePort,
          },
        },
        create: {
          flowId,
          sourceNodeId: operation.sourceNodeId,
          sourcePort: operation.sourcePort,
          targetNodeId: operation.targetNodeId,
        },
        update: { targetNodeId: operation.targetNodeId },
      });
    }
    return tx.flowNodeEdge.findMany({
      where: { flowId },
      orderBy: { createdAt: "asc" },
    });
  });
}

export const deleteFlowNodeEdge = async (flowId: string, edgeId: string) => {
  const [flow, edge] = await Promise.all([
    getFlowOrThrow(flowId),
    prisma.flowNodeEdge.findFirst({ where: { id: edgeId, flowId } }),
  ]);
  if (!edge) throw new AppError("Flow node edge not found", 404);
  await prisma.flowNodeEdge.delete({ where: { id: edgeId } });
  await regenerate(flowId, flow.companyId);
};
