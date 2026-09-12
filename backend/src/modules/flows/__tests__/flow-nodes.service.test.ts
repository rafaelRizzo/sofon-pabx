import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  clearPrismaMock,
  createPrismaMock,
} from "../../../test/mocks/prisma.mock";

const db = createPrismaMock();

mock.module("../../../lib/prisma", () => ({ prisma: db }));
mock.module("../cache/flows.cache", () => ({
  FlowsCache: { invalidateFlow: mock(), invalidateByCompany: mock(), invalidateNamespace: mock() },
}));
mock.module("../../../asterisk/flow-node.repository", () => ({
  FlowNodeRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/flow.repository", () => ({
  FlowRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/queue.repository", () => ({
  AsteriskQueueRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/announcement.repository", () => ({
  AnnouncementRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/timecondition.repository", () => ({
  TimeConditionRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/holidaygroup.repository", () => ({
  HolidayGroupRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/ivr.repository", () => ({
  IvrRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/variable.repository", () => ({
  VariableRepository: { regenerate: mock(() => Promise.resolve()) },
}));
mock.module("../../../asterisk/variablecondition.repository", () => ({
  VariableConditionRepository: { regenerate: mock(() => Promise.resolve()) },
}));

import * as FlowNodesService from "../flow-nodes.service";
import { FlowNodeRepository } from "../../../asterisk/flow-node.repository";

const FLOW = { id: "f1", companyId: "c1", entryNodeId: null };
const SOURCE = { id: "n1", flowId: "f1", type: "queue", resourceId: "q1" };
const TARGET = { id: "n2", flowId: "f1", type: "extension", resourceId: "e1" };
const EDGE = {
  id: "e1",
  flowId: "f1",
  sourceNodeId: "n1",
  sourcePort: "default",
  targetNodeId: "n2",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  clearPrismaMock(db);
  (FlowNodeRepository.regenerate as any).mockReset();
  (FlowNodeRepository.regenerate as any).mockResolvedValue(undefined);
});

describe("FlowNodesService.batchFlowNodeEdges", () => {
  it("applies all operations atomically and regenerates once", async () => {
    db.flow.findUnique.mockResolvedValue(FLOW);
    db.flowNode.findMany.mockResolvedValue([SOURCE, TARGET]);
    db.flowNodeEdge.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([EDGE]);

    const edges = await FlowNodesService.batchFlowNodeEdges("f1", [
      {
        type: "connect",
        sourceNodeId: "n1",
        sourcePort: "default",
        targetNodeId: "n2",
      },
    ]);

    expect(db.flowNodeEdge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          flowId: "f1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        }),
      }),
    );
    expect(edges).toEqual([EDGE]);
    expect(FlowNodeRepository.regenerate).toHaveBeenCalledTimes(1);
  });

  it("rejects a cycle before persisting any operation", async () => {
    db.flow.findUnique.mockResolvedValue(FLOW);
    db.flowNode.findMany.mockResolvedValue([SOURCE, TARGET]);
    db.flowNodeEdge.findMany.mockResolvedValue([
      { ...EDGE, sourceNodeId: "n2", targetNodeId: "n1" },
    ]);

    await expect(
      FlowNodesService.batchFlowNodeEdges("f1", [
        {
          type: "connect",
          sourceNodeId: "n1",
          sourcePort: "default",
          targetNodeId: "n2",
        },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(db.flowNodeEdge.upsert).not.toHaveBeenCalled();
    expect(FlowNodeRepository.regenerate).not.toHaveBeenCalled();
  });
});
