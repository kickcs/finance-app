export interface IngestCounts {
  imported: number;
  duplicates: number;
  unparsed: number;
}

type Flush = (counts: IngestCounts) => Promise<void>;

const DEBOUNCE_MS = 3000;

/** Копит результаты ingest по chatId и шлёт одну сводку после паузы в форвардах */
export class ReplyAggregator {
  private readonly pending = new Map<
    number,
    { counts: IngestCounts; timer: NodeJS.Timeout; flush: Flush }
  >();

  add(chatId: number, result: keyof IngestCounts, flush: Flush): void {
    const entry = this.pending.get(chatId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.counts[result] += 1;
      entry.flush = flush;
      entry.timer = setTimeout(() => {
        this.flushChat(chatId);
      }, DEBOUNCE_MS);
    } else {
      const counts: IngestCounts = { imported: 0, duplicates: 0, unparsed: 0 };
      counts[result] += 1;
      this.pending.set(chatId, {
        counts,
        flush,
        timer: setTimeout(() => {
          this.flushChat(chatId);
        }, DEBOUNCE_MS),
      });
    }
  }

  private flushChat(chatId: number): void {
    const entry = this.pending.get(chatId);
    if (!entry) return;
    this.pending.delete(chatId);
    void entry.flush(entry.counts);
  }
}
