import { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { handler } from '.';
import validateCode from '../code-validator';

jest.mock('../code-validator');

describe('api custom token authorizer', () => {
  let event: APIGatewayTokenAuthorizerEvent;

  beforeEach(() => {
    event = {
      type: 'TOKEN',
      authorizationToken: 'SHORTCODE',
      methodArn: 'methodArn'
    };
  });

  test('should return a policy approving access when a valid token is provided', async () => {
    (validateCode as jest.Mock).mockResolvedValue({
      isValid: true,
      shortCodeDefinition: {
        shortCode: 'SHORTCODE',
        id: 'uuid',
        active: true,
        startTime: 0,
        endTime: 1e14
      }
    });

    const response = await handler(event);
    expect(response).toEqual({
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: 'ALLOW',
        Resource: 'methodArn'
      }]
    });
    expect(validateCode).toHaveBeenCalledWith('SHORTCODE');
  });

  test('should return an explicit deny if the authorization token is not valid', async () => {

    (validateCode as jest.Mock).mockResolvedValue({
      isValid: false
    });

    const response = await handler(event);
    expect(response).toEqual({
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: 'DENY',
        Resource: 'methodArn'
      }]
    });
    expect(validateCode).toHaveBeenCalledWith('SHORTCODE');
  });
});
