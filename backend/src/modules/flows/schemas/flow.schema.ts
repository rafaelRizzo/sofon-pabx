import { z } from "zod";
import { timestamp, cuidParam, ok } from "../../../schemas/responses";
import {
  routeDestinationSchema,
  routeDestinationResponseSchema,
} from "../../../schemas/route-destination.schema";
import { usedBySchema } from "../../../schemas/flow-reference-label";

export const idParamSchema = z.object({ id: cuidParam });
export const flowNodeParamSchema = z.object({
  id: cuidParam,
  nodeId: cuidParam,
});
export const flowNodeEdgeParamSchema = z.object({
  id: cuidParam,
  edgeId: cuidParam,
});
export const companyQuerySchema = z.object({ companyId: z.cuid2() });

export const flowNodeTypeSchema = z.enum([
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
]);

const positionSchema = z.object({ x: z.number(), y: z.number() });

export const createFlowNodeSchema = z.object({
  type: flowNodeTypeSchema,
  resourceId: z.string().min(1).nullable().optional(),
  label: z.string().min(1).max(80).nullable().optional(),
  position: positionSchema.default({ x: 0, y: 0 }),
});

export const updateFlowNodeSchema = z
  .object({
    resourceId: z.string().min(1).nullable().optional(),
    label: z.string().min(1).max(80).nullable().optional(),
    position: positionSchema.optional(),
    isEntry: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one node field is required",
  });

export const connectFlowNodesSchema = z.object({
  sourceNodeId: z.cuid2(),
  sourcePort: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9:_-]+$/i),
  targetNodeId: z.cuid2(),
});

const disconnectFlowNodesSchema = z.object({
  sourceNodeId: z.cuid2(),
  sourcePort: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9:_-]+$/i),
});

export const batchFlowNodeEdgesSchema = z.object({
  operations: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("connect"),
          ...connectFlowNodesSchema.shape,
        }),
        z.object({
          type: z.literal("disconnect"),
          ...disconnectFlowNodesSchema.shape,
        }),
      ]),
    )
    .min(1)
    .max(100),
});

const layoutNodeSchema = z.object({
  nodeType: z.string().min(1),
  nodeId: z.string().min(1),
  // nome capturado no momento em que o nó foi colocado no canvas — usado só pra exibir um card
  // "solto" (ainda sem nenhuma conexão, então fora do GET /flows/:id/graph) sem precisar de outro
  // fetch por tipo/id; nó alcançável pelo grafo usa o nome resolvido ali, mais atual
  name: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
});

export const createFlowSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(
      /^[^\x00-\x1f\x7f]*$/,
      "Nome não pode conter caracteres de controle",
    ),
  companyId: z.cuid2(),
  entryDestination: routeDestinationSchema.optional(),
  layout: z.array(layoutNodeSchema).max(200).optional(),
});

export const updateFlowSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(80)
      .regex(
        /^[^\x00-\x1f\x7f]*$/,
        "Nome não pode conter caracteres de controle",
      )
      .optional(),
    entryDestination: routeDestinationSchema.optional(),
    layout: z.array(layoutNodeSchema).max(200).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required: name, entryDestination, layout",
  });

// PUT /flows/:id/layout — separado do update geral pra permitir autosave de posição no canvas
// sem revalidar/reprocessar entryDestination a cada arraste de nó.
export const updateFlowLayoutSchema = z.object({
  layout: z.array(layoutNodeSchema).max(200),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type UpdateFlowLayoutInput = z.infer<typeof updateFlowLayoutSchema>;

export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  entryDestination: routeDestinationResponseSchema,
  layout: z.array(layoutNodeSchema),
  usedBy: usedBySchema,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const ListFlowsResponse = ok({
  message: z.string(),
  flows: z.array(FlowSchema),
});
export const GetFlowResponse = ok({ message: z.string(), flow: FlowSchema });
export const CreateFlowResponse = ok({
  message: z.string(),
  flowId: z.string(),
});
export const UpdateFlowResponse = ok({ message: z.string() });

// GET /flows/:id/graph — nós alcançados a partir do entryDestination (BFS) + arestas entre eles,
// pro canvas desenhar o grafo inteiro, não só o nó de entrada.
const graphNodeSchema = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string(),
});
const graphEdgeSchema = z.object({
  from: z.object({ type: z.string(), id: z.string(), slot: z.string() }),
  to: z.object({ type: z.string(), id: z.string() }),
});
export const GetFlowGraphResponse = ok({
  message: z.string(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

const flowNodeSchema = z.object({
  id: z.string(),
  flowId: z.string(),
  type: flowNodeTypeSchema,
  resourceId: z.string().nullable(),
  label: z.string().nullable(),
  position: positionSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const flowNodeEdgeSchema = z.object({
  id: z.string(),
  flowId: z.string(),
  sourceNodeId: z.string(),
  sourcePort: z.string(),
  targetNodeId: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const GetFlowNodesResponse = ok({
  message: z.string(),
  entryNodeId: z.string().nullable(),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowNodeEdgeSchema),
});
export const CreateFlowNodeResponse = ok({
  message: z.string(),
  nodeId: z.string(),
});
export const ConnectFlowNodesResponse = ok({
  message: z.string(),
  edgeId: z.string(),
});
export const BatchFlowNodeEdgesResponse = ok({
  message: z.string(),
  edges: z.array(flowNodeEdgeSchema),
});

export const CheckResourceDeletionResponse = ok({
  message: z.string(),
  resource: z.object({
    type: flowNodeTypeSchema,
    resourceId: z.string(),
    companyId: z.string(),
  }),
});
