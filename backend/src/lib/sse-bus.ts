/**
 * SSE Event Bus
 *
 * In-process pub/sub for Server-Sent Events. When dashboard state is upserted,
 * `emitDashboardUpdate` broadcasts the new state to all open SSE connections
 * for that owner, so the frontend receives updates instantly instead of waiting
 * for the next polling cycle.
 */
import { EventEmitter } from "events";
import type { Response } from "express";

const bus = new EventEmitter();
bus.setMaxListeners(500); // support up to 500 concurrent SSE connections

/**
 * Push a dashboard state update to all SSE clients subscribed to `ownerAddress`.
 */
export function emitDashboardUpdate(ownerAddress: string, data: unknown): void {
  bus.emit(`dashboard:${ownerAddress.toLowerCase()}`, data);
}

/**
 * Register an SSE `res` object to receive dashboard updates for `ownerAddress`.
 * Returns an unsubscribe function — call it when the client disconnects.
 */
export function subscribeDashboard(ownerAddress: string, res: Response): () => void {
  const event = `dashboard:${ownerAddress.toLowerCase()}`;

  const listener = (data: unknown) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client already disconnected — ignore write error
    }
  };

  bus.on(event, listener);
  return () => bus.off(event, listener);
}
