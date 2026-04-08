export class RequestDedupeCache {
  private readonly seenByRequestId = new Map<string, number>();

  public constructor(private readonly ttlMs: number) {}

  public markIfNew(requestId: string, nowMs = Date.now()): boolean {
    this.cleanup(nowMs);

    const expiresAt = this.seenByRequestId.get(requestId);
    if (typeof expiresAt === "number" && expiresAt > nowMs) {
      return false;
    }

    this.seenByRequestId.set(requestId, nowMs + this.ttlMs);
    return true;
  }

  public size(nowMs = Date.now()): number {
    this.cleanup(nowMs);
    return this.seenByRequestId.size;
  }

  private cleanup(nowMs: number): void {
    for (const [requestId, expiresAt] of this.seenByRequestId.entries()) {
      if (expiresAt <= nowMs) {
        this.seenByRequestId.delete(requestId);
      }
    }
  }
}
