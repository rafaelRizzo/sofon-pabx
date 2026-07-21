import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as FlowsController from "./flows.controller";
import * as FlowNodesController from "./flow-nodes.controller";
import { protectedRoute } from "../../middleware/scope.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  createFlowSchema,
  updateFlowSchema,
  updateFlowLayoutSchema,
  idParamSchema,
  companyQuerySchema,
  flowNodeParamSchema,
  flowNodeEdgeParamSchema,
  createFlowNodeSchema,
  updateFlowNodeSchema,
  connectFlowNodesSchema,
  ListFlowsResponse,
  GetFlowResponse,
  CreateFlowResponse,
  UpdateFlowResponse,
  GetFlowGraphResponse,
  GetFlowNodesResponse,
  CreateFlowNodeResponse,
  ConnectFlowNodesResponse,
  CheckResourceDeletionResponse,
} from "./schemas/flow.schema";
import { errors, deleted } from "../../schemas/responses";

export const flowsRoutes = async (app: FastifyInstance) => {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    "/flows",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "view")],
      schema: {
        tags: ["Flows"],
        summary: "Listar flows por empresa",
        security: [{ bearerAuth: [] }],
        querystring: companyQuerySchema,
        response: {
          200: ListFlowsResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowsController.getFlows as any,
  );

  router.get(
    "/flows/:id",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "view")],
      schema: {
        tags: ["Flows"],
        summary: "Buscar flow",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: GetFlowResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowsController.getFlowById as any,
  );

  router.get(
    "/flows/:id/graph",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "view")],
      schema: {
        tags: ["Flows"],
        summary:
          "Grafo do flow (nós alcançáveis a partir do entryDestination + arestas)",
        description:
          "Só leitura — percorre os destinos de cada nó visitado a partir do entryDestination (BFS, com guard de ciclo). Usado pelo canvas visual pra desenhar o grafo inteiro, não só o nó de entrada.",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: GetFlowGraphResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowsController.getFlowGraph as any,
  );

  router.get(
    "/flows/:id/nodes",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "view")],
      schema: {
        tags: ["Flows"],
        summary: "Listar nós e conexões do canvas",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: GetFlowNodesResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowNodesController.getNodes as any,
  );

  router.post(
    "/flows/:id/nodes",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Adicionar instância de nó ao Flow",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: createFlowNodeSchema,
        response: {
          201: CreateFlowNodeResponse,
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowNodesController.createNode as any,
  );

  router.put(
    "/flows/:id/nodes/:nodeId",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Atualizar instância de nó",
        security: [{ bearerAuth: [] }],
        params: flowNodeParamSchema,
        body: updateFlowNodeSchema,
        response: {
          200: UpdateFlowResponse,
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowNodesController.updateNode as any,
  );

  router.delete(
    "/flows/:id/nodes/:nodeId",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Remover instância de nó",
        security: [{ bearerAuth: [] }],
        params: flowNodeParamSchema,
        response: {
          200: deleted,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowNodesController.deleteNode as any,
  );

  router.post(
    "/flows/:id/nodes/:nodeId/resource-deletion-check",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Validar exclusão do recurso de um nó",
        security: [{ bearerAuth: [] }],
        params: flowNodeParamSchema,
        response: {
          200: CheckResourceDeletionResponse,
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    FlowNodesController.checkResourceDeletion as any,
  );

  router.post(
    "/flows/:id/node-edges",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Conectar duas instâncias de nó",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: connectFlowNodesSchema,
        response: {
          201: ConnectFlowNodesResponse,
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    FlowNodesController.connectNodes as any,
  );

  router.delete(
    "/flows/:id/node-edges/:edgeId",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Remover conexão do canvas",
        security: [{ bearerAuth: [] }],
        params: flowNodeEdgeParamSchema,
        response: {
          200: deleted,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowNodesController.deleteEdge as any,
  );

  router.post(
    "/flows",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Criar flow",
        description:
          'Alias nomeado/reaproveitável pra uma cadeia de nós — aparece como type="flow" em qualquer RouteDestination.',
        security: [{ bearerAuth: [] }],
        body: createFlowSchema,
        response: {
          201: CreateFlowResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    FlowsController.createFlow as any,
  );

  router.put(
    "/flows/:id",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Atualizar flow",
        description: "Mínimo 1 campo obrigatório.",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: updateFlowSchema,
        response: {
          200: UpdateFlowResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    FlowsController.updateFlow as any,
  );

  router.put(
    "/flows/:id/layout",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Atualizar só o layout visual do canvas",
        description:
          "Separado do update geral pra permitir autosave de posição a cada arraste de nó, sem revalidar entryDestination.",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: updateFlowLayoutSchema,
        response: {
          200: UpdateFlowResponse,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowsController.updateFlowLayout as any,
  );

  router.delete(
    "/flows/:id",
    {
      onRequest: [...protectedRoute, requirePermission("flows", "manage")],
      schema: {
        tags: ["Flows"],
        summary: "Remover flow",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: deleted,
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    FlowsController.deleteFlow as any,
  );
};
