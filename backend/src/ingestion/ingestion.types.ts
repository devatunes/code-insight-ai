export interface ClonedRepo {
  /** Directorio temporal donde quedó el clone — llamar siempre a cleanup() al terminar. */
  path: string;
  cleanup: () => Promise<void>;
}
