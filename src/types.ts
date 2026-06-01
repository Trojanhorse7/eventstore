export type IndexEntry = {
  offset: number;
  length: number;
};

export type StoredEvent = Record<string, unknown> & {
  id: string;
  createdAt: string;
};
