/**
 * Shell hooks. The web build ships these as no-ops; a desktop (Steam) shell can replace
 * them later without touching the game. See docs/research/STEAM_PLAN.md §3.
 */
export const shell = {
  /** Called once per order completion; achievements would hang off this. */
  onOrderCompleted(_orderId: string, _final: boolean): void {},
  /** Called when a save is written; a cloud-aware shell could mirror it. */
  onSaved(): void {},
  /** Open an external link. The browser build opens a new tab; a shell may route it. */
  openLink(url: string): void {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  },
};
