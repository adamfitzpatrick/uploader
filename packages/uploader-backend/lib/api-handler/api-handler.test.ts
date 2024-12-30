import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '.';
import { marshall } from '@aws-sdk/util-dynamodb';

const getS3SignedUrlSpy = jest.fn();
const listObjectsSpy = jest.fn();
const putObjectSpy = jest.fn();
const s3SendSpy = jest.fn();
const getItemSpy = jest.fn();
const dbSendSpy = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: (...params: any[]) => getS3SignedUrlSpy(...params)
  }
});
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: function () {
      return {
        send: (...args: any[]) => s3SendSpy(...args)
      }
    },
    ListObjectsV2Command: function (params: any) { return listObjectsSpy(params); },
    PutObjectCommand: function (params: any) { return putObjectSpy(params); }
  }
});
jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: function () {
      return {
        send: (...args: any[]) => dbSendSpy(...args)
      }
    },
    GetItemCommand: function (params: any) { return getItemSpy(params); }
  }
})

describe('api handler', () => {
  let oldConsole: Console;
  let event: APIGatewayProxyEvent;

  beforeAll(() => {
    oldConsole = { ...console };
    console.warn = (message: string) => { };
    console.debug = (message: string) => { };
    console.info = (message: string) => { };
  });

  afterAll(() => {
    console.warn = oldConsole.warn;
    console.debug = oldConsole.debug;
    console.info = oldConsole.info;
  });

  beforeEach(() => {
    process.env['BUCKET'] = 'bucket';
    event = {
      requestContext: {
        httpMethod: 'GET'
      },
      pathParameters: {},
      headers: {
        Authorization: 'TOKEN'
      }
    } as any as APIGatewayProxyEvent;
    dbSendSpy.mockResolvedValue({
      Item: marshall({
        shortCode: 'SHORTCODE',
        id: 'uuid',
        active: true
      })
    })
  });

  describe('GET /signed-url/{filename}', () => {
    beforeEach(() => {
      event.requestContext.resourcePath = '/signed-url/{filename}';
      event.pathParameters!.filename = 'filename'
      putObjectSpy.mockReturnValue({});
      getS3SignedUrlSpy.mockResolvedValue('https://signed-url');
    });

    test('should obtain a pre-signed S3 URL for adding an item to an S3 bucket', async () => {
      await expect(handler(event)).resolves.toEqual({
        statusCode: 200,
        body: JSON.stringify({
          filename: 'filename',
          url: 'https://signed-url'
        }),
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Origin': '*',
        }
      });

      expect(putObjectSpy).toHaveBeenCalledWith({
        Bucket: 'bucket',
        Key: 'uuid/filename'
      });
      expect(getS3SignedUrlSpy).toHaveBeenCalledWith(expect.anything(), {}, { expiresIn: 3600 });
    });
  });

  describe('GET /list-uploaded-items', () => {
    let lastModified: string;

    beforeEach(() => {
      event.requestContext.resourcePath = '/list-uploaded-items';
      lastModified = new Date().toISOString();
      s3SendSpy.mockResolvedValue({
        isTruncated: false,
        Contents: [{
          Key: 'uuid/1',
          LastModified: lastModified
        }, {
          Key: 'wrongid/2',
          LastModified: lastModified
        }, {
          Key: 'uuid/3',
          LastModified: lastModified
        }]
      });
    });

    test('should return only those objects associated with the requestor\'s token value', async () => {
      const response = await handler(event);
      expect(response).toEqual(expect.objectContaining({
        statusCode: 200,
        body: JSON.stringify([{
          filename: '1',
          lastModified
        }, {
          filename: '3',
          lastModified
        }])
      }))
    });

    test('should make multiple calls to listObjectsV2 for truncated responses', () => { })
  });

  describe('when no lambda work path matches the API resource path', () => {
    test('should return a bad request error', async () => {
      event.requestContext.resourcePath = '/not/a/resource';
      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });
  })
});
