import validateCode, { ShortCodeDefinition } from '.';
import { marshall } from '@aws-sdk/util-dynamodb';

const sendSpy = jest.fn();
const getItemSpy = jest.fn();
const putItemSpy = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: function () {
      return {
        send: (...args: any) => { return sendSpy(...args); }
      };
    },
    GetItemCommand: function (params: any) { return getItemSpy(params) },
    PutItemCommand: function (params: any) { return putItemSpy(params) }
  }
});

describe('validateCode', () => {
  let oldConsole: Console;
  let startTime: number;
  let endTime: number;
  let shortCodeDef: ShortCodeDefinition;

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
    process.env['TABLE_NAME'] = 'table';
    process.env['MAX_CODE_LIFE'] = '86400';
    startTime = new Date().getTime() - 1000;
    endTime = new Date().getTime() + 1e5;
    shortCodeDef = {
      shortCode: 'SHORTCODE',
      id: 'uuid',
      active: true,
      startTime,
      endTime
    }
  });

  test('should validate an unused short code', async () => {
    delete shortCodeDef.startTime;
    delete shortCodeDef.endTime;
    sendSpy.mockResolvedValueOnce({
      Item: marshall(shortCodeDef)
    });

    const response = await validateCode('SHORTCODE');
    expect(response).toEqual({
      isValid: true,
      shortCodeDefinition: {
        shortCode: 'SHORTCODE',
        id: 'uuid',
        active: true,
        startTime: expect.anything(),
        endTime: expect.anything()
      }
    });

    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(putItemSpy).toHaveBeenCalledWith(expect.objectContaining({
      Item: {
        shortCode: { S: 'SHORTCODE' },
        id: { S: 'uuid' },
        active: { BOOL: true },
        startTime: { N: expect.anything() },
        endTime: { N: expect.anything() }
      }
    }));
  });

  test('should validate a valid short code', async () => {
    sendSpy.mockResolvedValue({
      Item: marshall(shortCodeDef)
    });

    const response = await validateCode('SHORTCODE');
    expect(response).toEqual({
      isValid: true,
      shortCodeDefinition: shortCodeDef
    });
    expect(sendSpy).toHaveBeenCalled();
    expect(getItemSpy).toHaveBeenCalled();
  });

  test('should return isValid = false for an inactive short code', async () => {
    shortCodeDef.active = false;
    sendSpy.mockResolvedValue({
      Item: marshall(shortCodeDef)
    });

    const response = await validateCode('SHORTCODE');
    expect(response).toEqual({
      isValid: false
    });
  });

  test('should return isValid = false for an expired short code', async () => {
    shortCodeDef.endTime = startTime;
    sendSpy.mockResolvedValue({
      Item: marshall(shortCodeDef)
    });

    const response = await validateCode('SHORTCODE');
    expect(response).toEqual({
      isValid: false
    });
  });

  test('should return isValid = false for a non-existant short code', async () => {
    sendSpy.mockResolvedValue({});
    let response = await validateCode('SHORTCODE');
    expect(response).toEqual({
      isValid: false
    });
  });
});
