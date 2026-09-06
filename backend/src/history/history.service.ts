import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMO_DOCUMENT_CLIENT, ANALYSES_TABLE_NAME } from './dynamo.module.js';
import type { AnalysisRecord } from './analysis-record.types.js';

@Injectable()
export class HistoryService {
  constructor(
    @Inject(DYNAMO_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(ANALYSES_TABLE_NAME) private readonly tableName: string,
  ) {}

  async save(record: AnalysisRecord): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: record }));
  }

  async findById(id: string): Promise<AnalysisRecord> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    if (!result.Item) {
      throw new NotFoundException(`No existe un análisis con id ${id}.`);
    }
    return result.Item as AnalysisRecord;
  }

  /**
   * Scan + sort en memoria: al volumen de una demo (decenas/cientos de
   * análisis) es más simple que mantener un GSI, y evita una decisión de
   * indexado prematura para un dato que todavía no tiene patrón de acceso
   * real más allá de "los últimos N".
   */
  async listRecent(limit = 20): Promise<AnalysisRecord[]> {
    const result = await this.client.send(new ScanCommand({ TableName: this.tableName }));
    const items = (result.Items ?? []) as AnalysisRecord[];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}
