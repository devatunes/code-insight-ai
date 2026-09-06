import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const DYNAMO_DOCUMENT_CLIENT = Symbol('DYNAMO_DOCUMENT_CLIENT');
export const ANALYSES_TABLE_NAME = Symbol('ANALYSES_TABLE_NAME');

const logger = new Logger('DynamoModule');

/**
 * Cliente DynamoDB compartido. En AWS toma credenciales del rol IAM del
 * task de Fargate (nunca hardcodeadas) y la tabla ya existe (creada por
 * Terraform); en local usa DynamoDB Local vía DYNAMO_ENDPOINT (ver
 * docker-compose.yml) y se auto-crea la tabla si falta, para no exigir un
 * paso manual de setup en desarrollo.
 */
@Module({
  providers: [
    {
      provide: DYNAMO_DOCUMENT_CLIENT,
      useFactory: () => {
        const client = new DynamoDBClient({
          endpoint: process.env.DYNAMO_ENDPOINT, // undefined en AWS real => usa el endpoint regional normal
          region: process.env.AWS_REGION ?? 'us-east-1',
        });
        return DynamoDBDocumentClient.from(client);
      },
    },
    {
      provide: ANALYSES_TABLE_NAME,
      useValue: process.env.ANALYSES_TABLE_NAME ?? 'code-insight-analyses',
    },
  ],
  exports: [DYNAMO_DOCUMENT_CLIENT, ANALYSES_TABLE_NAME],
})
export class DynamoModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    if (!process.env.DYNAMO_ENDPOINT) return; // solo auto-crea contra DynamoDB Local

    const client = new DynamoDBClient({
      endpoint: process.env.DYNAMO_ENDPOINT,
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
    const tableName = process.env.ANALYSES_TABLE_NAME ?? 'code-insight-analyses';

    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
    } catch {
      logger.log(`Creando tabla "${tableName}" en DynamoDB Local...`);
      await client.send(
        new CreateTableCommand({
          TableName: tableName,
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          BillingMode: 'PAY_PER_REQUEST',
        }),
      );
    }
  }
}
