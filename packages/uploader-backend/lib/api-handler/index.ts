import { _Object, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";

let dbClient = new DynamoDBClient();
let s3Client = new S3Client();

const addCORS = (baseResponse: APIGatewayProxyResult): APIGatewayProxyResult => {
  return {
    ...baseResponse,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Origin': '*',
    }
  }
}

async function getShortCodeDefinition(event: APIGatewayProxyEvent) {
  const TableName = process.env['TABLE_NAME'];
  const command = new GetItemCommand({
    TableName,
    Key: {
      pk: { S: event.headers.Authorization! }
    }
  });
  return unmarshall((await dbClient.send(command)).Item!)
}

async function handleGetSignedUrl(event: APIGatewayProxyEvent) {
  const shortCodeDef = await getShortCodeDefinition(event);
  const Bucket = process.env['BUCKET']!;
  const Key = `${shortCodeDef.id}/${event.pathParameters!.filename}`
  const command = new PutObjectCommand({
    Bucket,
    Key
  });
  const url = await getS3SignedUrl(s3Client, command, { expiresIn: 3600 });

  return addCORS({
    statusCode: 200,
    body: JSON.stringify({ filename: event.pathParameters!.filename, url })
  });
}

function filterItems(contents: _Object[], id: string) {
  return contents.filter(item => item.Key?.startsWith(`${id}/`))
    .map(item => {
      return {
        filename: item.Key!.replace(`${id}/`, ''),
        lastModified: item.LastModified
      }
    });
}

async function handleListUploadedItems(event: APIGatewayProxyEvent) {
  console.info(JSON.stringify(event));

  const shortCodeDef = await getShortCodeDefinition(event);
  const Bucket = process.env['BUCKET'];
  const command = new ListObjectsV2Command({
    Bucket
  });
  const response = await s3Client.send(command);
  const items = response.Contents ? filterItems(response.Contents, shortCodeDef.id) : [];

  return addCORS({
    statusCode: 200,
    body: JSON.stringify(items)
  })
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.info(JSON.stringify(event));

  const { resourcePath, httpMethod } = event.requestContext;

  let returnValue: APIGatewayProxyResult | null = null;
  if (resourcePath === '/signed-url/{filename}' && httpMethod === 'GET') {
    returnValue = await handleGetSignedUrl(event);
  } else if (resourcePath === '/list-uploaded-items' && httpMethod === 'GET') {
    returnValue = await handleListUploadedItems(event);
  } else {
    returnValue = {
      statusCode: 400,
      body: 'no resource match'
    }
  }

  return returnValue;
}
