import { NextRequest, NextResponse } from "next/server";
import { removeAgent, updateAgent, markSubscriptionsClosed } from "@/lib/agent-store";

// DELETE /api/agents/[id] — Remove a creator agent and mark all its subscriptions as closed
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (id.startsWith("demo-")) {
      return NextResponse.json({ error: "Cannot delete demo agents" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // If contractAddress is provided, mark all subscriptions closed first
    if (body.contractAddress) {
      await markSubscriptionsClosed(body.contractAddress);
    }

    const removed = await removeAgent(id);
    if (!removed) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}

// PATCH /api/agents/[id] — Update agent fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patch = await req.json();
    const updated = await updateAgent(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update agent:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}
