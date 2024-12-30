import { APIGatewayTokenAuthorizerEvent } from "aws-lambda";
import validateCode from "../code-validator";

function generatePolicy(allow: boolean, methodArn: string) {
    return {
        Version: '2012-10-17',
        Statement: [{
            Action: 'execute-api:Invoke',
            Effect: allow ? 'ALLOW' : 'DENY',
            Resource: methodArn
        }]
    };
}

export async function handler(event: APIGatewayTokenAuthorizerEvent) {
    const validationResult = await validateCode(event.authorizationToken);

    return generatePolicy(validationResult.isValid, event.methodArn);
}
