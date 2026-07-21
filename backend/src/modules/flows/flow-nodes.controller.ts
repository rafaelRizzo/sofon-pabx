import type { FastifyReply, FastifyRequest } from "fastify";
import { handleError } from "../../utils/errors/handler.error";
import * as FlowNodesService from "./flow-nodes.service";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/errors/app.error";

async function assertFlowAccess(request: FastifyRequest, flowId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { companyId: true },
  });
  if (!flow) throw new AppError("Flow not found", 404);
  request.scope.assertAccess(flow.companyId);
}

export const getNodes = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id } = request.params as { id: string };
    await assertFlowAccess(request, id);
    const graph = await FlowNodesService.getFlowNodes(id);
    return reply.send({
      success: true,
      message: "Flow nodes fetched successfully",
      ...graph,
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const createNode = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id } = request.params as { id: string };
    await assertFlowAccess(request, id);
    const node = await FlowNodesService.createFlowNode(id, request.body as any);
    return reply.status(201).send({
      success: true,
      message: "Flow node created successfully",
      nodeId: node.id,
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const updateNode = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id, nodeId } = request.params as { id: string; nodeId: string };
    await assertFlowAccess(request, id);
    await FlowNodesService.updateFlowNode(id, nodeId, request.body as any);
    return reply.send({
      success: true,
      message: "Flow node updated successfully",
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const deleteNode = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id, nodeId } = request.params as { id: string; nodeId: string };
    await assertFlowAccess(request, id);
    await FlowNodesService.deleteFlowNode(id, nodeId);
    return reply.send({
      success: true,
      message: "Flow node deleted successfully",
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const checkResourceDeletion = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id, nodeId } = request.params as { id: string; nodeId: string };
    await assertFlowAccess(request, id);
    const resource = await FlowNodesService.assertNodeResourceCanBeDeleted(
      id,
      nodeId,
    );
    return reply.send({
      success: true,
      message: "Resource can be deleted",
      resource,
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const connectNodes = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id } = request.params as { id: string };
    await assertFlowAccess(request, id);
    const edge = await FlowNodesService.connectFlowNodes(
      id,
      request.body as any,
    );
    return reply.status(201).send({
      success: true,
      message: "Flow nodes connected successfully",
      edgeId: edge.id,
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const batchEdges = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id } = request.params as { id: string };
    await assertFlowAccess(request, id);
    const { operations } = request.body as any;
    const edges = await FlowNodesService.batchFlowNodeEdges(id, operations);
    return reply.send({
      success: true,
      message: "Flow node edges synchronized successfully",
      edges,
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};

export const deleteEdge = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id, edgeId } = request.params as { id: string; edgeId: string };
    await assertFlowAccess(request, id);
    await FlowNodesService.deleteFlowNodeEdge(id, edgeId);
    return reply.send({
      success: true,
      message: "Flow node edge deleted successfully",
    });
  } catch (error) {
    return handleError(reply, error, request);
  }
};
