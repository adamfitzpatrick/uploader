import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

let TableName: string;
let MAX_CODE_LIFE: number;
const client = new DynamoDBClient();

export interface ShortCodeDefinition {
  shortCode: string;
  id: string;
  active: boolean,
  startTime?: number;
  endTime?: number;
}

interface ValidationResult {
  isValid: boolean;
  shortCodeDefinition?: ShortCodeDefinition
}

async function conditionallyInitializeShortCode(shortCodeDef: ShortCodeDefinition): Promise<ShortCodeDefinition> {
  if (shortCodeDef.startTime) {
    return shortCodeDef;
  }

  const startTime = new Date().getTime();
  const initializedShortCode = {
    ...shortCodeDef,
    startTime,
    endTime: startTime + MAX_CODE_LIFE
  }

  const command = new PutItemCommand({
    TableName,
    Item: marshall(initializedShortCode)
  });
  await client.send(command)
  return initializedShortCode;
}

export default async function validateCode(shortCode: string) {
  TableName = process.env['TABLE_NAME']!;
  MAX_CODE_LIFE = parseInt(process.env['MAX_CODE_LIFE']!, 10);

  const command = new GetItemCommand({
    TableName,
    Key: { pk: marshall(shortCode) }
  });

  const response = await client.send(command);

  if (!response.Item) {
    return { isValid: false }
  }

  const shortCodeDef = await conditionallyInitializeShortCode(
    unmarshall(response.Item!) as ShortCodeDefinition);

  const now = new Date().getTime();
  const isValid = shortCodeDef.active &&
    shortCodeDef.startTime! <= now &&
    shortCodeDef.endTime! > now;

  const result: ValidationResult = { isValid }
  if (isValid) {
    result.shortCodeDefinition = shortCodeDef
  }
  return result;
}
