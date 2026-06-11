import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, requestId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const request = await prisma.expenseEditRequest.findUnique({
    where: { id: requestId },
    include: {
      approvals: true,
      expense: { include: { splits: true } },
      requester: { select: { id: true, name: true } },
    },
  });

  if (!request || request.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }
  if (request.requesterId === payload.userId) {
    return NextResponse.json({ error: "You cannot approve your own request" }, { status: 403 });
  }

  // Create approval (unique constraint prevents double-voting)
  try {
    await prisma.expenseEditApproval.create({
      data: { requestId, approverId: payload.userId },
    });
  } catch {
    return NextResponse.json({ error: "Already approved" }, { status: 409 });
  }

  const approvalCount = request.approvals.length + 1;

  if (approvalCount >= request.requiredApprovals) {
    // Apply the edit
    const updateData: Record<string, unknown> = {};
    if (request.proposedTitle !== null && request.proposedTitle !== undefined) updateData.title = request.proposedTitle;
    if (request.proposedAmount !== null && request.proposedAmount !== undefined) updateData.amount = request.proposedAmount;
    if (request.proposedCategory !== null && request.proposedCategory !== undefined) updateData.category = request.proposedCategory;
    if ("proposedNotes" in request) updateData.notes = request.proposedNotes;

    const updatedExpense = await prisma.expense.update({
      where: { id: request.expenseId },
      data: updateData,
      include: { splits: true },
    });

    // If amount changed and split method is EQUAL, recalculate splits
    if (request.proposedAmount !== null && request.proposedAmount !== undefined) {
      const perPerson = request.proposedAmount / updatedExpense.splits.length;
      await Promise.all(
        updatedExpense.splits.map(s =>
          prisma.expenseSplit.update({
            where: { id: s.id },
            data: { amount: parseFloat(perPerson.toFixed(2)) },
          })
        )
      );
    }

    await prisma.expenseEditRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", appliedAt: new Date() },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: request.requesterId,
        apartmentId,
        type: "EXPENSE_EDIT_APPROVED",
        title: "Edit request approved",
        body: `Your edit to "${request.originalTitle}" has been approved and applied.`,
        link: `/apartment/${apartmentId}/finance`,
      },
    });

    return NextResponse.json({ status: "APPROVED", approvalCount, requiredApprovals: request.requiredApprovals });
  }

  return NextResponse.json({ status: "PENDING", approvalCount, requiredApprovals: request.requiredApprovals });
}
